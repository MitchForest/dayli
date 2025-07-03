import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type OptimizeCalendarResponse } from '../types/responses';
import { getCurrentUserId, storeProposedChanges } from '../utils/helpers';
import { generateText, generateObject, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, addDays } from 'date-fns';

const parameters = z.object({
  startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
  days: z.number().default(7).describe("Number of days to optimize"),
});

export const optimizeCalendar = registerTool(
  createTool<typeof parameters, OptimizeCalendarResponse>({
    name: 'workflow_optimizeCalendar',
    description: "Optimize calendar by finding conflicts and suggesting improvements",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Optimize Calendar',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ startDate, days }) => {
      try {
        const targetStartDate = startDate || format(new Date(), 'yyyy-MM-dd');
        
        // Step 1: Analyze calendar situation
        const { object: analysis } = await generateObject({
          model: openai('gpt-4o'),
          schema: z.object({
            hasConflicts: z.boolean(),
            hasBackToBackMeetings: z.boolean(),
            hasFragmentedSchedule: z.boolean(),
            averageMeetingDensity: z.number(),
            optimizationStrategy: z.enum(['consolidate', 'spread-out', 'protect-focus', 'minimal'])
          }),
          prompt: `Analyze calendar for ${days} days starting ${targetStartDate} to determine optimization needs.`
        });
        
        // Step 2: Define sub-tools based on analysis
        const analyzeCalendar = tool({
          description: 'Analyze calendar for conflicts and inefficiencies',
          parameters: z.object({
            startDate: z.string(),
            days: z.number()
          }),
          execute: async ({ startDate, days }) => {
            const factory = ServiceFactory.getInstance();
            const scheduleService = factory.getScheduleService();
            const calendarService = factory.getCalendarService();
            
            // Get schedule for date range
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + days);
            
            // Workaround: Get schedule for each day in range
            const schedule = [];
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
              const daySchedule = await scheduleService.getScheduleForDate(
                format(d, 'yyyy-MM-dd')
              );
              schedule.push(...daySchedule);
            }
            
            // Get calendar events
            const events = await calendarService.listEvents({
              calendarId: 'primary',
              timeMin: new Date(startDate).toISOString(),
              timeMax: endDate.toISOString()
            });
            
            // Extract the actual events from the response
            const eventList = events.items || [];
            
            // Detect conflicts
            const conflicts: Array<{ type: string; events: any[]; severity: string }> = [];
            
            // Check for double-bookings
            for (let i = 0; i < eventList.length - 1; i++) {
              for (let j = i + 1; j < eventList.length; j++) {
                const event1 = eventList[i];
                const event2 = eventList[j];
                
                if (!event1 || !event2) continue;
                
                // Parse event times
                const start1 = new Date(event1.start?.dateTime || event1.start?.date || '');
                const end1 = new Date(event1.end?.dateTime || event1.end?.date || '');
                const start2 = new Date(event2.start?.dateTime || event2.start?.date || '');
                const end2 = new Date(event2.end?.dateTime || event2.end?.date || '');
                
                if (start1 < end2 && start2 < end1) {
                  conflicts.push({
                    type: 'double-booked',
                    events: [event1, event2],
                    severity: 'high'
                  });
                }
              }
            }
            
            // Check for back-to-back meetings
            const sortedEvents = [...eventList].sort((a, b) => {
              const aStart = new Date(a.start?.dateTime || a.start?.date || '');
              const bStart = new Date(b.start?.dateTime || b.start?.date || '');
              return aStart.getTime() - bStart.getTime();
            });
            
            for (let i = 0; i < sortedEvents.length - 1; i++) {
              const current = sortedEvents[i];
              const next = sortedEvents[i + 1];
              
              if (!current || !next) continue;
              
              const currentEnd = new Date(current.end?.dateTime || current.end?.date || '');
              const nextStart = new Date(next.start?.dateTime || next.start?.date || '');
              
              if (currentEnd.getTime() === nextStart.getTime()) {
                conflicts.push({
                  type: 'back-to-back',
                  events: [current, next],
                  severity: 'medium'
                });
              }
            }
            
            // Check for fragmented schedule
            const inefficiencies = [];
            const gaps = [];
            
            for (let i = 0; i < sortedEvents.length - 1; i++) {
              const current = sortedEvents[i];
              const next = sortedEvents[i + 1];
              
              if (!current || !next) continue;
              
              const currentEnd = new Date(current.end?.dateTime || current.end?.date || '');
              const nextStart = new Date(next.start?.dateTime || next.start?.date || '');
              const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);
              
              if (gapMinutes > 0 && gapMinutes < 30) {
                gaps.push({
                  duration: gapMinutes,
                  between: [current.summary || 'Untitled', next.summary || 'Untitled']
                });
              }
            }
            
            if (gaps.length >= 3) {
              inefficiencies.push({
                type: 'fragmented',
                description: `${gaps.length} small gaps between meetings`,
                impact: 'Reduces focus time'
              });
            }
            
            return {
              conflicts,
              inefficiencies,
              totalMeetings: eventList.length,
              totalConflicts: conflicts.length,
              meetingHours: eventList.reduce((sum: number, e: any) => {
                const start = new Date(e.start?.dateTime || e.start?.date || '');
                const end = new Date(e.end?.dateTime || e.end?.date || '');
                return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              }, 0)
            };
          }
        });
        
        const generateSolutions = tool({
          description: 'Generate optimization suggestions',
          parameters: z.object({
            conflicts: z.array(z.any()),
            inefficiencies: z.array(z.any()),
            strategy: z.string()
          }),
          execute: async ({ conflicts, inefficiencies, strategy }) => {
            const suggestions: Array<{
              id: string;
              type: 'consolidate' | 'reschedule' | 'cancel' | 'shorten';
              reason: string;
              impact: string;
              meetings: string[];
              targetIds: string[];
              proposedTime?: string;
            }> = [];
            
            // Solutions for conflicts
            conflicts.forEach((conflict: any) => {
              if (conflict.type === 'double-booked') {
                suggestions.push({
                  id: crypto.randomUUID(),
                  type: 'reschedule',
                  reason: `Reschedule "${conflict.events[1].title}" to avoid double-booking`,
                  impact: 'Resolves scheduling conflict',
                  meetings: [conflict.events[1].title],
                  targetIds: [conflict.events[1].id],
                  proposedTime: 'Next available slot'
                });
              } else if (conflict.type === 'back-to-back') {
                suggestions.push({
                  id: crypto.randomUUID(),
                  type: 'shorten',
                  reason: `Add buffer between "${conflict.events[0].title}" and "${conflict.events[1].title}"`,
                  impact: 'Prevents meeting fatigue',
                  meetings: conflict.events.map((e: any) => e.title),
                  targetIds: conflict.events.map((e: any) => e.id)
                });
              }
            });
            
            // Solutions for inefficiencies
            if (strategy === 'consolidate' && inefficiencies.some((i: any) => i.type === 'fragmented')) {
              suggestions.push({
                id: crypto.randomUUID(),
                type: 'consolidate',
                reason: 'Group similar meetings together',
                impact: 'Creates larger focus blocks',
                meetings: ['All 1:1 meetings', 'All team meetings'],
                targetIds: []
              });
            }
            
            // Calculate potential time saved
            const potentialTimeSaved = suggestions.reduce((sum, s) => {
              if (s.type === 'cancel') return sum + 60;
              if (s.type === 'shorten') return sum + 15;
              if (s.type === 'consolidate') return sum + 30;
              return sum;
            }, 0);
            
            return {
              suggestions,
              potentialTimeSaved
            };
          }
        });
        
        // Final answer tool
        const finalizeOptimization = tool({
          description: 'Finalize calendar optimization plan',
          parameters: z.object({
            suggestions: z.array(z.any()),
            potentialTimeSaved: z.number()
          }),
          execute: async ({ suggestions, potentialTimeSaved }) => {
            return {
              suggestions,
              potentialTimeSaved
            };
          }
        });
        
        // Execute workflow with dynamic tools
        const tools: any = {
          analyzeCalendar,
          ...(analysis.hasConflicts || analysis.hasFragmentedSchedule ? { generateSolutions } : {}),
          finalizeOptimization
        };
        
        const { toolCalls } = await generateText({
          model: openai('gpt-4o'),
          tools,
          maxSteps: 3,
          system: `You are an AI assistant optimizing the user's calendar.
          
Context from analysis:
- Has conflicts: ${analysis.hasConflicts}
- Has back-to-back meetings: ${analysis.hasBackToBackMeetings}
- Has fragmented schedule: ${analysis.hasFragmentedSchedule}
- Meeting density: ${analysis.averageMeetingDensity}
- Strategy: ${analysis.optimizationStrategy}

Your task:
1. Analyze calendar for conflicts and inefficiencies
2. ${analysis.hasConflicts || analysis.hasFragmentedSchedule ? 'Generate optimization suggestions' : 'Skip suggestions - calendar is well-organized'}
3. Finalize the optimization plan

Focus on practical improvements that respect existing commitments.`,
          prompt: `Optimize my calendar for the next ${days} days starting ${targetStartDate}.`,
          onStepFinish: ({ toolCalls }) => {
            if (toolCalls && toolCalls.length > 0) {
              console.log(`[optimizeCalendar] Step completed: ${toolCalls[0]?.toolName}`);
            }
          }
        });
        
        // Extract final plan using .args
        const finalAnswer = toolCalls?.find(tc => tc && tc.toolName === 'finalizeOptimization');
        if (!finalAnswer) {
          throw new Error('Workflow did not produce a final optimization plan');
        }
        
        const plan = finalAnswer.args as any;
        
        // Store proposal if there are suggestions
        let proposalId: string | undefined;
        if (plan.suggestions.length > 0) {
          proposalId = crypto.randomUUID();
          await storeProposedChanges(proposalId, plan.suggestions);
        }
        
        // Return pure data matching OptimizeCalendarResponse
        return {
          success: true,
          proposalId,
          suggestions: plan.suggestions.map((s: any) => ({
            type: s.type,
            meetings: s.meetings,
            reason: s.reason,
            impact: s.impact
          })),
          potentialTimeSaved: plan.potentialTimeSaved
        };
      } catch (error) {
        console.error('[Workflow: optimizeCalendar] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to optimize calendar',
          suggestions: [],
          potentialTimeSaved: 0
        };
      }
    },
  })
);