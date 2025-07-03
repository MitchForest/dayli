import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, differenceInMinutes, format, addMinutes } from 'date-fns';

interface ScheduleGap {
  startTime: string;
  endTime: string;
  duration: number; // minutes
  type: 'morning' | 'midday' | 'afternoon' | 'evening';
  suitableFor: string[];
  quality: 'high' | 'medium' | 'low';
}

export const findScheduleGaps = tool({
  description: 'Find unutilized time slots in the schedule for potential activities',
  parameters: z.object({
    date: z.string().describe('Date to analyze (YYYY-MM-DD)'),
    minGapMinutes: z.number().optional().default(30).describe('Minimum gap size to report'),
    includeCalendar: z.boolean().optional().default(true).describe('Include calendar events'),
  }),
  execute: async ({ date, minGapMinutes, includeCalendar }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'findScheduleGaps',
      operation: 'read' as const,
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
        .select('work_start_time, work_end_time, lunch_start_time, lunch_duration_minutes')
        .eq('user_id', user.id)
        .single();
      
      const workStart = preferences?.work_start_time || '09:00';
      const workEnd = preferences?.work_end_time || '17:00';
      
      // Get all scheduled items for the day
      const blocks = await scheduleService.getScheduleForDate(date);
      
      // Get calendar events if requested
      let calendarEvents: any[] = [];
      if (includeCalendar) {
        const calendarResponse = await calendarService.listEvents({
          calendarId: 'primary',
          timeMin: `${date}T00:00:00Z`,
          timeMax: `${date}T23:59:59Z`,
        });
        calendarEvents = calendarResponse.items || [];
      }
      
      // Combine all busy times
      const busyTimes: Array<{ start: Date; end: Date }> = [
        ...blocks.map(block => ({
          start: block.startTime,
          end: block.endTime,
        })),
        ...calendarEvents
          .filter((event: any) => event.start?.dateTime && event.end?.dateTime)
          .map((event: any) => ({
            start: parseISO(event.start.dateTime),
            end: parseISO(event.end.dateTime),
          })),
      ];
      
      // Sort by start time
      busyTimes.sort((a, b) => a.start.getTime() - b.start.getTime());
      
      // Merge overlapping times
      const mergedBusy: typeof busyTimes = [];
      for (const time of busyTimes) {
        if (mergedBusy.length === 0) {
          mergedBusy.push(time);
        } else {
          const last = mergedBusy[mergedBusy.length - 1];
          if (last && time.start <= last.end) {
            // Overlapping, extend the end time if needed
            last.end = new Date(Math.max(last.end.getTime(), time.end.getTime()));
          } else {
            mergedBusy.push(time);
          }
        }
      }
      
      // Find gaps
      const gaps: ScheduleGap[] = [];
      const workStartTime = parseISO(`${date}T${workStart}`);
      const workEndTime = parseISO(`${date}T${workEnd}`);
      
      // Check gap at start of day
      const firstBusy = mergedBusy[0];
      if (mergedBusy.length === 0 || (firstBusy && firstBusy.start > workStartTime)) {
        const gapEnd = mergedBusy.length > 0 && firstBusy ? firstBusy.start : workEndTime;
        const duration = differenceInMinutes(gapEnd, workStartTime);
        
        if (duration >= minGapMinutes) {
          gaps.push(createGap(workStartTime, gapEnd, duration));
        }
      }
      
      // Check gaps between busy times
      for (let i = 0; i < mergedBusy.length - 1; i++) {
        const current = mergedBusy[i];
        const next = mergedBusy[i + 1];
        if (!current || !next) continue;
        
        const gapStart = current.end;
        const gapEnd = next.start;
        const duration = differenceInMinutes(gapEnd, gapStart);
        
        if (duration >= minGapMinutes && gapEnd <= workEndTime) {
          gaps.push(createGap(gapStart, gapEnd, duration));
        }
      }
      
      // Check gap at end of day
      if (mergedBusy.length > 0) {
        const lastBusy = mergedBusy[mergedBusy.length - 1];
        if (lastBusy && lastBusy.end < workEndTime) {
          const lastEnd = lastBusy.end;
          const duration = differenceInMinutes(workEndTime, lastEnd);
          if (duration >= minGapMinutes) {
            gaps.push(createGap(lastEnd, workEndTime, duration));
          }
        }
      }
      
      // Calculate statistics
      const totalGapTime = gaps.reduce((sum, gap) => sum + gap.duration, 0);
      const largestGap = gaps.reduce((max, gap) => gap.duration > max ? gap.duration : max, 0);
      const avgGapSize = gaps.length > 0 ? Math.round(totalGapTime / gaps.length) : 0;
      
      return buildToolResponse(
        toolOptions,
        {
          date,
          gaps,
          statistics: {
            totalGaps: gaps.length,
            totalGapMinutes: totalGapTime,
            totalGapHours: Math.round(totalGapTime / 60 * 10) / 10,
            largestGapMinutes: largestGap,
            averageGapMinutes: avgGapSize,
            utilizationPercentage: Math.round((1 - totalGapTime / (8 * 60)) * 100),
          },
        },
        {
          type: 'list',
          title: 'Schedule Gaps Found',
          description: `Found ${gaps.length} gaps totaling ${Math.round(totalGapTime / 60 * 10) / 10} hours`,
          priority: gaps.length > 3 ? 'high' : 'medium',
          components: gaps.slice(0, 3).map(gap => ({
            type: 'scheduleBlock',
            data: {
              id: `gap-${gap.startTime}`,
              type: 'work' as const,
              title: `Available: ${gap.duration} minutes`,
              startTime: format(parseISO(gap.startTime), 'HH:mm'),
              endTime: format(parseISO(gap.endTime), 'HH:mm'),
              description: `${gap.quality} quality time - suitable for: ${gap.suitableFor.join(', ')}`,
            },
          })),
        },
        {
          suggestions: gaps.length > 0 && gaps[0] ? [
            `Schedule ${gaps[0].suitableFor[0] || 'tasks'} in the ${gaps[0].type} gap`,
            'Batch similar tasks in larger gaps',
            'Use small gaps for quick tasks',
            'Protect large gaps for deep work',
          ] : [
            'Your schedule is fully utilized',
            'Consider delegating some tasks',
            'Review meeting necessity',
          ],
          notification: {
            show: true,
            type: totalGapTime > 120 ? 'info' : 'warning',
            message: totalGapTime > 120 
              ? `${Math.round(totalGapTime / 60)} hours available for tasks`
              : 'Limited time available today',
            duration: 4000,
          },
          actions: gaps.length > 0 ? [{
            id: 'fill-largest',
            label: `Fill ${Math.round(largestGap / 60 * 10) / 10}h Gap`,
            variant: 'primary',
            action: {
              type: 'message',
              message: `Find tasks to fill the ${largestGap}-minute gap`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[FIND GAPS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Gap Analysis Failed',
          description: 'Could not analyze schedule gaps.',
        }
      );
    }
  },
});

function createGap(start: Date, end: Date, duration: number): ScheduleGap {
  const hour = start.getHours();
  let type: ScheduleGap['type'];
  let quality: ScheduleGap['quality'];
  let suitableFor: string[];
  
  // Determine time of day
  if (hour < 12) {
    type = 'morning';
    quality = duration >= 90 ? 'high' : 'medium';
    suitableFor = duration >= 90 
      ? ['deep work', 'creative tasks', 'planning']
      : ['emails', 'quick tasks', 'reviews'];
  } else if (hour < 14) {
    type = 'midday';
    quality = 'low'; // Post-lunch dip
    suitableFor = ['administrative tasks', 'emails', 'light reading'];
  } else if (hour < 17) {
    type = 'afternoon';
    quality = duration >= 60 ? 'medium' : 'low';
    suitableFor = duration >= 60
      ? ['meetings', 'collaborative work', 'problem solving']
      : ['quick calls', 'status updates', 'planning'];
  } else {
    type = 'evening';
    quality = 'low';
    suitableFor = ['wrap-up tasks', 'planning tomorrow', 'learning'];
  }
  
  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    duration,
    type,
    suitableFor,
    quality,
  };
} 