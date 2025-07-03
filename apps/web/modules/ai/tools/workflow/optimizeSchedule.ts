import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type OptimizeScheduleResponse } from '../types/responses';
import { getCurrentUserId, storeProposedChanges } from '../utils/helpers';
import { format } from 'date-fns';
import { generateText, generateObject, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  date: z.string().optional().describe("Date to optimize in YYYY-MM-DD format"),
  focus: z.enum(["deep-work", "meetings", "mixed", "light"]).optional(),
});

export const optimizeSchedule = registerTool(
  createTool<typeof parameters, OptimizeScheduleResponse>({
    name: 'workflow_optimizeSchedule',
    description: "Intelligently analyze and optimize your daily schedule for maximum productivity",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Optimize Schedule',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ date, focus }) => {
      try {
        const userId = await getCurrentUserId();
        const targetDate = date || format(new Date(), 'yyyy-MM-dd');
        
        // Step 1: Analyze current schedule context
        const { object: analysis } = await generateObject({
          model: openai('gpt-4o'),
          schema: z.object({
            hasConflicts: z.boolean(),
            utilizationPercentage: z.number(),
            fragmentationLevel: z.enum(['high', 'medium', 'low']),
            needsOptimization: z.boolean(),
            strategy: z.enum(['full-rebuild', 'fill-gaps', 'optimize-existing', 'minimal'])
          }),
          prompt: `Analyze schedule for ${targetDate} to determine optimization strategy.
          Consider: current blocks, gaps, conflicts, and user preference for ${focus || 'mixed'} work.`
        });
        
        // Step 2: Define sub-tools based on analysis
        const analyzeSchedule = tool({
          description: 'Analyze current schedule for gaps, conflicts, and optimization opportunities',
          parameters: z.object({
            date: z.string()
          }),
          execute: async ({ date }) => {
            const factory = ServiceFactory.getInstance();
            const scheduleService = factory.getScheduleService();
            const taskService = factory.getTaskService();
            const gmailService = factory.getGmailService();
            
            // Fetch all data in parallel
            const [schedule, tasks, emails] = await Promise.all([
              scheduleService.getScheduleForDate(date),
              taskService.getUnassignedTasks(),
              gmailService.listMessages({ maxResults: 50, q: 'is:unread' })
            ]);
            
            // Analyze gaps
            const gaps: Array<{ startTime: string; endTime: string; duration: number }> = [];
            const sortedBlocks = schedule.sort((a: any, b: any) => a.startTime.getTime() - b.startTime.getTime());
            
            // Check morning gap
            if (sortedBlocks.length === 0 || (sortedBlocks[0] && sortedBlocks[0].startTime.getHours() > 9)) {
              gaps.push({
                startTime: '09:00',
                endTime: sortedBlocks[0]?.startTime ? format(sortedBlocks[0].startTime, 'HH:mm') : '12:00',
                duration: sortedBlocks[0] ? (sortedBlocks[0].startTime.getHours() - 9) * 60 : 180
              });
            }
            
            // Detect gaps
            for (let i = 0; i < sortedBlocks.length - 1; i++) {
                const currentBlock = sortedBlocks[i];
                const nextBlock = sortedBlocks[i + 1];
                if (!currentBlock || !nextBlock) continue;
                
                const gap = nextBlock.startTime.getTime() - currentBlock.endTime.getTime();
                if (gap > 15 * 60 * 1000) { // Gaps larger than 15 minutes
                  gaps.push({
                    startTime: format(currentBlock.endTime, 'HH:mm'),
                    endTime: format(nextBlock.startTime, 'HH:mm'),
                    duration: Math.floor(gap / (1000 * 60))
                  });
                }
              }
              
              // Detect conflicts
              const conflicts = [];
              for (let i = 0; i < sortedBlocks.length - 1; i++) {
                const currentBlock = sortedBlocks[i];
                const nextBlock = sortedBlocks[i + 1];
                if (!currentBlock || !nextBlock) continue;
                
                if (currentBlock.endTime > nextBlock.startTime) {
                  conflicts.push({
                    block1: currentBlock.title,
                    block2: nextBlock.title,
                    overlap: Math.floor((currentBlock.endTime.getTime() - nextBlock.startTime.getTime()) / (1000 * 60))
                  });
                }
              }
            
            return {
              currentBlocks: sortedBlocks,
              gaps,
              conflicts,
              totalGapTime: gaps.reduce((sum, g) => sum + g.duration, 0),
              highPriorityTasks: tasks.filter((t: any) => t.priority === 'high').length,
              unreadEmails: emails.messages.length
            };
          }
        });
        
        const generateOptimizationStrategy = tool({
          description: 'Generate optimization proposals based on analysis',
          parameters: z.object({
            analysis: z.any(),
            focus: z.string().optional()
          }),
          execute: async ({ analysis, focus }) => {
            const proposals = [];
            
            // Handle conflicts first
            if (analysis.conflicts.length > 0) {
              analysis.conflicts.forEach((conflict: any) => {
                proposals.push({
                  type: 'move',
                  reason: `Resolve conflict between "${conflict.block1}" and "${conflict.block2}"`,
                  impact: 'Eliminates scheduling conflict',
                  priority: 'high'
                });
              });
            }
            
            // Fill large gaps
            if (analysis.totalGapTime > 120) {
              proposals.push({
                type: 'create',
                reason: `You have ${analysis.totalGapTime} minutes of unused time`,
                impact: 'Better time utilization',
                priority: 'medium',
                suggestion: focus === 'deep-work' ? 'Add focused work blocks' : 'Add task batching blocks'
              });
            }
            
            // Handle high priority tasks
            if (analysis.highPriorityTasks > 3) {
              proposals.push({
                type: 'create',
                reason: `${analysis.highPriorityTasks} high-priority tasks need attention`,
                impact: 'Ensures important work gets done',
                priority: 'high',
                suggestion: 'Schedule dedicated task blocks'
              });
            }
            
            // Email management
            if (analysis.unreadEmails > 20) {
              proposals.push({
                type: 'create',
                reason: `${analysis.unreadEmails} unread emails need processing`,
                impact: 'Prevents email backlog',
                priority: 'medium',
                suggestion: 'Add email processing block'
              });
            }
            
            return {
              proposals,
              estimatedImpact: {
                timeRecovered: analysis.totalGapTime * 0.8,
                conflictsResolved: analysis.conflicts.length,
                tasksSchedulable: Math.min(analysis.highPriorityTasks, Math.floor(analysis.totalGapTime / 30))
              }
            };
          }
        });
        
        // Only include the answer tool if we need structured output
        const finalizeOptimization = tool({
          description: 'Finalize the optimization plan',
          parameters: z.object({
            proposedChanges: z.array(z.any()),
            metrics: z.any()
          }),
          execute: async ({ proposedChanges, metrics }) => {
            return {
              proposedChanges,
              metrics
            };
          }
        });
        
        // Step 3: Execute workflow with dynamic tools
        const tools: any = {
          analyzeSchedule,
          ...(analysis.needsOptimization && { generateOptimizationStrategy }),
          finalizeOptimization
        };
        
        const { toolCalls } = await generateText({
          model: openai('gpt-4o'),
          tools,
          maxSteps: analysis.needsOptimization ? 3 : 2,
          system: `You are an AI assistant optimizing the user's schedule for ${targetDate}.
          
Context from analysis:
- Utilization: ${analysis.utilizationPercentage}%
- Fragmentation: ${analysis.fragmentationLevel}
- Strategy: ${analysis.strategy}
- Focus preference: ${focus || 'mixed'}

Your task:
1. Analyze the current schedule
2. ${analysis.needsOptimization ? 'Generate optimization proposals based on the strategy' : 'Identify minor improvements'}
3. Create a final optimization plan

Be practical and respect existing commitments.`,
          prompt: `Optimize the schedule for ${targetDate} with focus on ${focus || 'efficiency'}.`,
          onStepFinish: ({ toolCalls }) => {
            if (toolCalls && toolCalls.length > 0) {
              console.log(`[optimizeSchedule] Step completed: ${toolCalls[0]?.toolName}`);
            }
          }
        });
        
        // Extract the final optimization plan
        const finalAnswer = toolCalls?.find(tc => tc && tc.toolName === 'finalizeOptimization');
        if (!finalAnswer) {
          throw new Error('Workflow did not produce a final optimization plan');
        }
        
        const plan = finalAnswer.args as any;
        
        // Store the proposal if there are changes
        let proposalId: string | undefined;
        if (plan.proposedChanges.length > 0) {
          proposalId = crypto.randomUUID();
          await storeProposedChanges(proposalId, plan.proposedChanges);
        }
        
        // Return pure data
        return {
          success: true,
          date: targetDate,
          changes: plan.proposedChanges.map((change: any) => ({
            type: change.type,
            description: change.reason,
            impact: change.impact
          })),
          metrics: {
            utilizationBefore: plan.metrics.utilizationBefore,
            utilizationAfter: plan.metrics.utilizationAfter,
            focusTimeBefore: plan.metrics.focusTimeGained,
            focusTimeAfter: plan.metrics.focusTimeGained + plan.metrics.focusTimeGained
          },
          proposalId
        };
      } catch (error) {
        console.error('[Workflow: optimizeSchedule] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to optimize schedule',
          date: date || format(new Date(), 'yyyy-MM-dd'),
          changes: [],
          metrics: {
            utilizationBefore: 0,
            utilizationAfter: 0,
            focusTimeBefore: 0,
            focusTimeAfter: 0
          }
        };
      }
    },
  })
); 