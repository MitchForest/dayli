import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, differenceInMinutes, format, addMinutes } from 'date-fns';
import { parseFlexibleTime } from '../../utils/time-parser';

interface TimeGap {
  startTime: Date;
  endTime: Date;
  duration: number;
  beforeBlock?: any;
  afterBlock?: any;
}

interface ConsolidationSuggestion {
  type: 'merge_gaps' | 'extend_block' | 'create_focus_block' | 'remove_gap';
  description: string;
  impact: string;
  gaps: TimeGap[];
  resultingDuration: number;
}

export const consolidateFragmentedTime = tool({
  description: 'Find and consolidate small time gaps to create larger, more useful time blocks',
  parameters: z.object({
    date: z.string().describe('Date to analyze (YYYY-MM-DD)'),
    minGapSize: z.number().optional().default(15)
      .describe('Minimum gap size in minutes to consider'),
    maxGapSize: z.number().optional().default(45)
      .describe('Maximum gap size in minutes to consolidate'),
    targetBlockSize: z.number().optional().default(60)
      .describe('Target size for consolidated blocks'),
  }),
  execute: async ({ date, minGapSize, maxGapSize, targetBlockSize }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'consolidateFragmentedTime',
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
        .select('work_start_time, work_end_time')
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
      
      // Combine and sort all busy times
      const busyTimes = [
        ...blocks.map(b => ({
          start: b.startTime,
          end: b.endTime,
          type: b.type,
          title: b.title,
          source: 'schedule' as const,
          data: b,
        })),
        ...events
          .filter((e: any) => e.start?.dateTime)
          .map((e: any) => ({
            start: parseISO(e.start.dateTime),
            end: parseISO(e.end.dateTime),
            type: 'meeting',
            title: e.summary,
            source: 'calendar' as const,
            data: e,
          })),
      ].sort((a, b) => a.start.getTime() - b.start.getTime());
      
      // Find gaps
      const gaps: TimeGap[] = [];
      const workStartTime = parseFlexibleTime(preferences?.work_start_time || '09:00');
      const workEndTime = parseFlexibleTime(preferences?.work_end_time || '17:00');
      
      if (!workStartTime || !workEndTime) {
        throw new Error('Invalid work hours in preferences');
      }
      
      // Create full date times from parsed times
      const workStart = parseISO(date);
      workStart.setHours(workStartTime.hour, workStartTime.minute, 0, 0);
      const workEnd = parseISO(date);
      workEnd.setHours(workEndTime.hour, workEndTime.minute, 0, 0);
      
      // Check gap at start of day
      if (busyTimes.length === 0 || (busyTimes[0] && busyTimes[0].start > workStart)) {
        const firstBusy = busyTimes[0];
        const gapEnd = busyTimes.length > 0 && firstBusy ? firstBusy.start : workEnd;
        const duration = differenceInMinutes(gapEnd, workStart);
        if (duration >= minGapSize && duration <= maxGapSize) {
          gaps.push({
            startTime: workStart,
            endTime: gapEnd,
            duration,
            afterBlock: busyTimes[0],
          });
        }
      }
      
      // Check gaps between busy times
      for (let i = 0; i < busyTimes.length - 1; i++) {
        const current = busyTimes[i];
        const next = busyTimes[i + 1];
        if (!current || !next) continue;
        
        const gapStart = current.end;
        const gapEnd = next.start;
        const duration = differenceInMinutes(gapEnd, gapStart);
        
        if (duration >= minGapSize && duration <= maxGapSize) {
          gaps.push({
            startTime: gapStart,
            endTime: gapEnd,
            duration,
            beforeBlock: busyTimes[i],
            afterBlock: busyTimes[i + 1],
          });
        }
      }
      
      // Check gap at end of day
      if (busyTimes.length > 0) {
        const lastBusy = busyTimes[busyTimes.length - 1];
        if (lastBusy && lastBusy.end < workEnd) {
          const lastEnd = lastBusy.end;
          const duration = differenceInMinutes(workEnd, lastEnd);
          if (duration >= minGapSize && duration <= maxGapSize) {
            gaps.push({
              startTime: lastEnd,
              endTime: workEnd,
              duration,
              beforeBlock: busyTimes[busyTimes.length - 1],
            });
          }
        }
      }
      
      // Generate consolidation suggestions
      const suggestions: ConsolidationSuggestion[] = [];
      
      // Look for adjacent gaps that can be merged
      for (let i = 0; i < gaps.length - 1; i++) {
        const gap1 = gaps[i];
        const gap2 = gaps[i + 1];
        if (!gap1 || !gap2) continue;
        
        // Check if gaps are separated by a short, moveable block
        if (gap1.afterBlock && gap2.beforeBlock && 
            gap1.afterBlock === gap2.beforeBlock &&
            gap1.afterBlock.source === 'schedule' &&
            gap1.afterBlock.type !== 'meeting') {
          
          const blockDuration = differenceInMinutes(gap1.afterBlock.end, gap1.afterBlock.start);
          const totalDuration = gap1.duration + gap2.duration + blockDuration;
          
          if (totalDuration >= targetBlockSize) {
            suggestions.push({
              type: 'merge_gaps',
              description: `Move "${gap1.afterBlock.title}" to create ${Math.round(totalDuration / 60 * 10) / 10}h block`,
              impact: 'Creates continuous focus time',
              gaps: [gap1, gap2],
              resultingDuration: totalDuration,
            });
          }
        }
      }
      
      // Look for blocks that can be extended into adjacent gaps
      gaps.forEach(gap => {
        if (gap.beforeBlock && gap.beforeBlock.source === 'schedule' && 
            gap.beforeBlock.type === 'work' && gap.duration >= 15) {
          suggestions.push({
            type: 'extend_block',
            description: `Extend "${gap.beforeBlock.title}" by ${gap.duration} minutes`,
            impact: 'Reduces context switching',
            gaps: [gap],
            resultingDuration: differenceInMinutes(gap.beforeBlock.end, gap.beforeBlock.start) + gap.duration,
          });
        }
      });
      
      // Suggest creating focus blocks from larger gaps
      const largerGaps = gaps.filter(g => g.duration >= 30);
      if (largerGaps.length >= 2) {
        const totalTime = largerGaps.reduce((sum, g) => sum + g.duration, 0);
        suggestions.push({
          type: 'create_focus_block',
          description: `Combine ${largerGaps.length} gaps into focus blocks`,
          impact: `Creates ${Math.round(totalTime / 60 * 10) / 10} hours of focus time`,
          gaps: largerGaps,
          resultingDuration: totalTime,
        });
      }
      
      // Calculate fragmentation metrics
      const totalGapTime = gaps.reduce((sum, g) => sum + g.duration, 0);
      const avgGapSize = gaps.length > 0 ? Math.round(totalGapTime / gaps.length) : 0;
      const fragmentationScore = gaps.length > 0 ? Math.min(100, (gaps.length * 20)) : 0;
      
      return buildToolResponse(
        toolOptions,
        {
          date,
          gaps: gaps.map(g => ({
            startTime: format(g.startTime, 'HH:mm'),
            endTime: format(g.endTime, 'HH:mm'),
            duration: g.duration,
            beforeBlockTitle: g.beforeBlock?.title,
            afterBlockTitle: g.afterBlock?.title,
          })),
          metrics: {
            totalGaps: gaps.length,
            totalGapMinutes: totalGapTime,
            averageGapSize: avgGapSize,
            fragmentationScore,
            smallGaps: gaps.filter(g => g.duration < 30).length,
            mediumGaps: gaps.filter(g => g.duration >= 30 && g.duration < 60).length,
          },
          suggestions: suggestions.slice(0, 5),
        },
        {
          type: 'list',
          title: 'Time Fragmentation Analysis',
          description: `Found ${gaps.length} gaps totaling ${Math.round(totalGapTime / 60 * 10) / 10} hours`,
          priority: fragmentationScore > 60 ? 'high' : 'medium',
          components: suggestions.slice(0, 3).map(suggestion => ({
            type: 'confirmationDialog',
            data: {
              title: suggestion.description,
              message: suggestion.impact,
              confirmText: 'Apply',
              cancelText: 'Skip',
              variant: 'info' as const,
            },
          })),
        },
        {
          suggestions: suggestions.length > 0 ? [
            'Consolidate small gaps into focus blocks',
            'Extend existing work blocks',
            'Move flexible tasks to create continuous time',
            'Batch administrative tasks in small gaps',
          ] : [
            'Schedule is already well-consolidated',
            'Consider protecting existing focus time',
            'Maintain current time block structure',
          ],
          notification: {
            show: true,
            type: fragmentationScore > 60 ? 'warning' : 'success',
            message: fragmentationScore > 60
              ? `High fragmentation detected - ${gaps.length} gaps found`
              : 'Schedule has good time consolidation',
            duration: 4000,
          },
          actions: suggestions.length > 0 && suggestions[0] ? [{
            id: 'apply-consolidation',
            label: 'Apply Top Suggestion',
            variant: 'primary',
            action: {
              type: 'message',
              message: suggestions[0].description,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[CONSOLIDATE TIME] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Time Consolidation Failed',
          description: 'Could not analyze time fragmentation.',
        }
      );
    }
  },
}); 