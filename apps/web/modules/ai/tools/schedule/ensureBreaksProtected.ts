import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, differenceInMinutes, format, addMinutes, isWithinInterval } from 'date-fns';
import { parseFlexibleTime } from '../../utils/time-parser';

interface BreakViolation {
  type: 'missing' | 'shortened' | 'overridden';
  expectedTime: string;
  actualTime?: string;
  conflictingBlock?: any;
  severity: 'high' | 'medium' | 'low';
}

interface BreakProtectionAction {
  type: 'create_break' | 'extend_break' | 'move_block' | 'shorten_block';
  description: string;
  targetTime: string;
  duration: number;
  impact: string;
}

export const ensureBreaksProtected = tool({
  description: 'Analyze and protect break times in the schedule',
  parameters: z.object({
    date: z.string().describe('Date to analyze (YYYY-MM-DD)'),
    enforceMode: z.boolean().optional().default(false)
      .describe('If true, automatically create/protect breaks'),
  }),
  execute: async ({ date, enforceMode }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'ensureBreaksProtected',
      operation: enforceMode ? 'create' as const : 'read' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get user preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('lunch_start_time, lunch_duration_minutes, break_schedule')
        .eq('user_id', user.id)
        .single();
      
      // Get schedule blocks
      const blocks = await scheduleService.getScheduleForDate(date);
      
      // Get calendar events
      const calendarResponse = await calendarService.listEvents({
        calendarId: 'primary',
        timeMin: `${date}T00:00:00Z`,
        timeMax: `${date}T23:59:59Z`,
      });
      const events = calendarResponse.items || [];
      
      // Define expected breaks
      const expectedBreaks = [];
      const violations: BreakViolation[] = [];
      const actions: BreakProtectionAction[] = [];
      
      // Lunch break
      const lunchStart = parseFlexibleTime(preferences?.lunch_start_time || '12:00');
      const lunchDuration = preferences?.lunch_duration_minutes || 60;
      
      if (lunchStart) {
        const lunchStartTime = parseISO(date);
        lunchStartTime.setHours(lunchStart.hour, lunchStart.minute, 0, 0);
        const lunchEndTime = addMinutes(lunchStartTime, lunchDuration);
        
        expectedBreaks.push({
          type: 'lunch',
          startTime: lunchStartTime,
          endTime: lunchEndTime,
          duration: lunchDuration,
        });
        
        // Check if lunch break exists
        const lunchBlock = blocks.find(block => 
          block.type === 'break' && 
          block.title.toLowerCase().includes('lunch')
        );
        
        if (!lunchBlock) {
          // Check for conflicts
          const conflictingItems = [
            ...blocks.filter(b => {
              const blockStart = parseISO(`${date}T${b.startTime}`);
              const blockEnd = parseISO(`${date}T${b.endTime}`);
              return isWithinInterval(lunchStartTime, { start: blockStart, end: blockEnd }) ||
                     isWithinInterval(lunchEndTime, { start: blockStart, end: blockEnd });
            }),
            ...events.filter((e: any) => {
              if (!e.start?.dateTime) return false;
              const eventStart = parseISO(e.start.dateTime);
              const eventEnd = parseISO(e.end.dateTime);
              return isWithinInterval(lunchStartTime, { start: eventStart, end: eventEnd }) ||
                     isWithinInterval(lunchEndTime, { start: eventStart, end: eventEnd });
            }),
          ];
          
          violations.push({
            type: 'missing',
            expectedTime: format(lunchStartTime, 'HH:mm'),
            conflictingBlock: conflictingItems[0],
            severity: 'high',
          });
          
          actions.push({
            type: 'create_break',
            description: 'Schedule lunch break',
            targetTime: format(lunchStartTime, 'HH:mm'),
            duration: lunchDuration,
            impact: 'Ensures proper nutrition and energy recovery',
          });
        }
      }
      
      // Additional breaks from preferences
      const breakSchedule = preferences?.break_schedule as any;
      if (breakSchedule && Array.isArray(breakSchedule)) {
        breakSchedule.forEach((scheduledBreak: any) => {
          const breakTime = parseFlexibleTime(scheduledBreak.time);
          if (breakTime) {
            const breakStartTime = parseISO(date);
            breakStartTime.setHours(breakTime.hour, breakTime.minute, 0, 0);
            const breakEndTime = addMinutes(breakStartTime, scheduledBreak.duration || 15);
            
            expectedBreaks.push({
              type: scheduledBreak.type || 'break',
              startTime: breakStartTime,
              endTime: breakEndTime,
              duration: scheduledBreak.duration || 15,
            });
          }
        });
      }
      
      // Check for long stretches without breaks
      const sortedBusyTimes = [
        ...blocks.map(b => ({
          start: parseISO(`${date}T${b.startTime}`),
          end: parseISO(`${date}T${b.endTime}`),
          type: b.type,
          title: b.title,
        })),
        ...events
          .filter((e: any) => e.start?.dateTime)
          .map((e: any) => ({
            start: parseISO(e.start.dateTime),
            end: parseISO(e.end.dateTime),
            type: 'meeting',
            title: e.summary,
          })),
      ].sort((a, b) => a.start.getTime() - b.start.getTime());
      
      // Find stretches longer than 3 hours without breaks
      for (let i = 0; i < sortedBusyTimes.length; i++) {
        const currentBlock = sortedBusyTimes[i];
        let stretchEnd = currentBlock.end;
        let j = i + 1;
        
        // Find continuous work stretch
        while (j < sortedBusyTimes.length) {
          const nextBlock = sortedBusyTimes[j];
          const gap = differenceInMinutes(nextBlock.start, stretchEnd);
          
          if (gap <= 15) { // Less than 15 min gap, consider continuous
            stretchEnd = nextBlock.end;
            j++;
          } else {
            break;
          }
        }
        
        const stretchDuration = differenceInMinutes(stretchEnd, currentBlock.start);
        if (stretchDuration > 180) { // More than 3 hours
          violations.push({
            type: 'missing',
            expectedTime: format(addMinutes(currentBlock.start, 120), 'HH:mm'),
            severity: 'medium',
          });
          
          actions.push({
            type: 'create_break',
            description: `Add break after ${Math.round(stretchDuration / 60)} hours of continuous work`,
            targetTime: format(addMinutes(currentBlock.start, 120), 'HH:mm'),
            duration: 15,
            impact: 'Prevents burnout and maintains productivity',
          });
        }
        
        i = j - 1; // Skip processed blocks
      }
      
      // Execute actions if in enforce mode
      let createdBreaks = 0;
      if (enforceMode && actions.length > 0) {
        for (const action of actions) {
          if (action.type === 'create_break') {
            try {
              await scheduleService.createTimeBlock({
                title: action.targetTime.includes('12:') ? 'Lunch Break' : 'Break',
                type: 'break',
                startTime: action.targetTime,
                endTime: format(
                  addMinutes(parseISO(`${date}T${action.targetTime}`), action.duration),
                  'HH:mm'
                ),
                date,
                description: 'Protected break time',
              });
              createdBreaks++;
            } catch (error) {
              console.error('Failed to create break:', error);
            }
          }
        }
      }
      
      // Calculate protection score
      const totalExpectedBreaks = expectedBreaks.length + Math.floor(8 / 3); // Expect break every 3 hours
      const actualBreaks = blocks.filter(b => b.type === 'break').length;
      const protectionScore = Math.round((actualBreaks / totalExpectedBreaks) * 100);
      
      return buildToolResponse(
        toolOptions,
        {
          date,
          expectedBreaks: expectedBreaks.map(b => ({
            type: b.type,
            time: format(b.startTime, 'HH:mm'),
            duration: b.duration,
          })),
          actualBreaks: blocks.filter(b => b.type === 'break').map(b => ({
            title: b.title,
            time: b.startTime,
            duration: differenceInMinutes(
              parseISO(`${date}T${b.endTime}`),
              parseISO(`${date}T${b.startTime}`)
            ),
          })),
          violations,
          protectionScore,
          actions: actions.slice(0, 3),
          createdBreaks: enforceMode ? createdBreaks : 0,
        },
        {
          type: 'list',
          title: 'Break Protection Analysis',
          description: `Protection score: ${protectionScore}% - ${violations.length} issues found`,
          priority: violations.length > 0 ? 'high' : 'low',
          components: [
            {
              type: 'progressIndicator',
              data: {
                label: 'Break Protection Score',
                percentage: protectionScore,
                current: actualBreaks,
                total: totalExpectedBreaks,
                description: protectionScore < 50 ? 'Critical - Add breaks' : 
                            protectionScore < 80 ? 'Needs improvement' : 'Good protection',
              },
            },
            ...violations.slice(0, 3).map(violation => ({
              type: 'confirmationDialog' as const,
              data: {
                title: `${violation.type === 'missing' ? 'Missing' : 'Violated'} break at ${violation.expectedTime}`,
                message: violation.conflictingBlock ? 
                  `Conflicts with: ${violation.conflictingBlock.title}` : 
                  'No break scheduled',
                details: 'Regular breaks improve focus and prevent burnout',
                variant: violation.severity === 'high' ? 'danger' : 'warning',
              },
            })),
          ],
        },
        {
          suggestions: violations.length > 0 ? [
            'Schedule regular breaks every 2-3 hours',
            'Protect lunch time from meetings',
            'Add 5-minute micro-breaks between tasks',
            'Use breaks for movement and stretching',
          ] : [
            'Maintain current break schedule',
            'Consider adding walking meetings',
            'Use breaks for mindfulness',
          ],
          notification: {
            show: true,
            type: violations.length > 0 ? 'warning' : 'success',
            message: enforceMode && createdBreaks > 0 
              ? `Created ${createdBreaks} break blocks`
              : violations.length > 0 
                ? `${violations.length} break violations detected`
                : 'Break times are well-protected',
            duration: 4000,
          },
          actions: !enforceMode && actions.length > 0 ? [{
            id: 'enforce-breaks',
            label: 'Protect All Breaks',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Protect break times for ${date}`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[BREAK PROTECTION] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Break Protection Failed',
          description: 'Could not analyze or protect break times.',
        }
      );
    }
  },
}); 