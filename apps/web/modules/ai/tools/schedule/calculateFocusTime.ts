import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, differenceInMinutes, format } from 'date-fns';

interface FocusTimeMetrics {
  totalAvailable: number; // minutes
  longestBlock: number; // minutes
  fragmentationIndex: number; // 0-1, higher = more fragmented
  blocks: Array<{
    startTime: string;
    endTime: string;
    duration: number;
    quality: 'high' | 'medium' | 'low';
  }>;
  recommendations: string[];
}

export const calculateFocusTime = tool({
  description: 'Calculate available focus time and fragmentation metrics',
  parameters: z.object({
    date: z.string().describe('Date to analyze (YYYY-MM-DD)'),
    minBlockMinutes: z.number().optional().default(60).describe('Minimum block size for deep work'),
  }),
  execute: async ({ date, minBlockMinutes }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'calculateFocusTime',
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
        .select('work_start_time, work_end_time, protect_deep_work')
        .eq('user_id', user.id)
        .single();
      
      const workStart = preferences?.work_start_time || '09:00';
      const workEnd = preferences?.work_end_time || '17:00';
      
      // Get schedule blocks
      const blocks = await scheduleService.getScheduleForDate(date);
      
      // Get calendar events
      const calendarResponse = await calendarService.listEvents({
        calendarId: 'primary',
        timeMin: `${date}T00:00:00Z`,
        timeMax: `${date}T23:59:59Z`,
      });
      const calendarEvents = calendarResponse.items || [];
      
      // Find all busy times (meetings, breaks, blocked time)
      const busyTimes: Array<{ start: Date; end: Date; type: string }> = [
        ...blocks
          .filter(b => b.type !== 'work') // Exclude work blocks as they're available for focus
          .map(block => ({
            start: block.startTime,
            end: block.endTime,
            type: block.type,
          })),
        ...calendarEvents
          .filter((event: any) => event.start?.dateTime && event.end?.dateTime)
          .map((event: any) => ({
            start: parseISO(event.start.dateTime),
            end: parseISO(event.end.dateTime),
            type: 'meeting',
          })),
      ];
      
      // Sort and merge overlapping busy times
      busyTimes.sort((a, b) => a.start.getTime() - b.start.getTime());
      
      const mergedBusy: typeof busyTimes = [];
      for (const time of busyTimes) {
        if (mergedBusy.length === 0) {
          mergedBusy.push(time);
        } else {
          const last = mergedBusy[mergedBusy.length - 1];
          if (time.start <= last.end) {
            last.end = new Date(Math.max(last.end.getTime(), time.end.getTime()));
          } else {
            mergedBusy.push(time);
          }
        }
      }
      
      // Calculate focus time blocks
      const workStartTime = parseISO(`${date}T${workStart}`);
      const workEndTime = parseISO(`${date}T${workEnd}`);
      const focusBlocks: FocusTimeMetrics['blocks'] = [];
      
      // Check start of day
      if (mergedBusy.length === 0 || mergedBusy[0].start > workStartTime) {
        const blockEnd = mergedBusy.length > 0 ? mergedBusy[0].start : workEndTime;
        const duration = differenceInMinutes(blockEnd, workStartTime);
        
        if (duration >= minBlockMinutes) {
          focusBlocks.push({
            startTime: workStartTime.toISOString(),
            endTime: blockEnd.toISOString(),
            duration,
            quality: duration >= 120 ? 'high' : duration >= 90 ? 'medium' : 'low',
          });
        }
      }
      
      // Check between busy times
      for (let i = 0; i < mergedBusy.length - 1; i++) {
        const blockStart = mergedBusy[i].end;
        const blockEnd = mergedBusy[i + 1].start;
        const duration = differenceInMinutes(blockEnd, blockStart);
        
        if (duration >= minBlockMinutes && blockEnd <= workEndTime) {
          focusBlocks.push({
            startTime: blockStart.toISOString(),
            endTime: blockEnd.toISOString(),
            duration,
            quality: duration >= 120 ? 'high' : duration >= 90 ? 'medium' : 'low',
          });
        }
      }
      
      // Check end of day
      if (mergedBusy.length > 0) {
        const lastEnd = mergedBusy[mergedBusy.length - 1].end;
        if (lastEnd < workEndTime) {
          const duration = differenceInMinutes(workEndTime, lastEnd);
          if (duration >= minBlockMinutes) {
            focusBlocks.push({
              startTime: lastEnd.toISOString(),
              endTime: workEndTime.toISOString(),
              duration,
              quality: duration >= 120 ? 'high' : duration >= 90 ? 'medium' : 'low',
            });
          }
        }
      }
      
      // Calculate metrics
      const totalAvailable = focusBlocks.reduce((sum, block) => sum + block.duration, 0);
      const longestBlock = focusBlocks.reduce((max, block) => Math.max(max, block.duration), 0);
      
      // Fragmentation index: 0 = perfect (one big block), 1 = highly fragmented
      const idealBlocks = Math.ceil(totalAvailable / 180); // Ideal: 3-hour blocks
      const actualBlocks = focusBlocks.length;
      const fragmentationIndex = actualBlocks > 0 
        ? Math.min(1, (actualBlocks - idealBlocks) / actualBlocks)
        : 0;
      
      // Generate recommendations
      const recommendations: string[] = [];
      
      if (fragmentationIndex > 0.5) {
        recommendations.push('Consider consolidating meetings to create longer focus blocks');
      }
      
      if (longestBlock < 120) {
        recommendations.push('No blocks longer than 2 hours - protect morning time for deep work');
      }
      
      if (totalAvailable < 240) {
        recommendations.push('Less than 4 hours of focus time - review meeting necessity');
      }
      
      const highQualityBlocks = focusBlocks.filter(b => b.quality === 'high').length;
      if (highQualityBlocks === 0) {
        recommendations.push('No high-quality focus blocks - aim for at least one 2+ hour block');
      }
      
      return buildToolResponse(
        toolOptions,
        {
          date,
          metrics: {
            totalAvailable,
            longestBlock,
            fragmentationIndex,
            blocks: focusBlocks,
            recommendations,
          } as FocusTimeMetrics,
          summary: {
            totalHours: Math.round(totalAvailable / 60 * 10) / 10,
            blockCount: focusBlocks.length,
            highQualityBlocks,
            fragmentationPercentage: Math.round(fragmentationIndex * 100),
          },
        },
        {
          type: 'list',
          title: 'Focus Time Analysis',
          description: `${Math.round(totalAvailable / 60 * 10) / 10} hours available across ${focusBlocks.length} blocks`,
          priority: totalAvailable < 180 ? 'high' : 'medium',
          components: focusBlocks.slice(0, 3).map(block => ({
            type: 'scheduleBlock',
            data: {
              id: `focus-${block.startTime}`,
              type: 'work' as const,
              title: `Focus Block: ${Math.round(block.duration / 60 * 10) / 10}h`,
              startTime: format(parseISO(block.startTime), 'HH:mm'),
              endTime: format(parseISO(block.endTime), 'HH:mm'),
              description: `${block.quality} quality focus time`,
            },
          })),
        },
        {
          suggestions: recommendations.length > 0 ? recommendations : [
            'Focus time is well-protected',
            'Consider time-boxing specific projects',
            'Use Pomodoro technique in shorter blocks',
          ],
          notification: {
            show: true,
            type: fragmentationIndex > 0.5 ? 'warning' : 'info',
            message: fragmentationIndex > 0.5
              ? `Schedule is ${Math.round(fragmentationIndex * 100)}% fragmented`
              : `Good focus time availability`,
            duration: 4000,
          },
          actions: focusBlocks.length > 0 ? [{
            id: 'protect-focus',
            label: 'Protect Focus Blocks',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Block calendar time for the ${focusBlocks.length} focus blocks`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[CALCULATE FOCUS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Focus Time Calculation Failed',
          description: 'Could not analyze focus time availability.',
        }
      );
    }
  },
}); 