import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, differenceInMinutes, format, addDays, startOfWeek, endOfWeek } from 'date-fns';

interface DayLoad {
  date: string;
  totalMinutes: number;
  workMinutes: number;
  meetingMinutes: number;
  breakMinutes: number;
  loadScore: number; // 0-100, higher = more loaded
  blocks: number;
}

interface BalanceSuggestion {
  type: 'move' | 'split' | 'delegate' | 'cancel';
  fromDate: string;
  toDate: string;
  item: {
    id: string;
    title: string;
    duration: number;
    type: string;
  };
  impact: string;
  feasibility: 'high' | 'medium' | 'low';
}

export const balanceScheduleLoad = tool({
  description: 'Analyze and suggest ways to balance workload across days',
  parameters: z.object({
    weekStartDate: z.string().describe('Start of week to analyze (YYYY-MM-DD)'),
    targetVariance: z.number().optional().default(20)
      .describe('Target variance percentage between days'),
    includeWeekends: z.boolean().optional().default(false),
  }),
  execute: async ({ weekStartDate, targetVariance, includeWeekends }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'balanceScheduleLoad',
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
      
      // Calculate work hours from start/end times
      const workStart = preferences?.work_start_time || '09:00';
      const workEnd = preferences?.work_end_time || '17:00';
      const startHour = parseInt(workStart.split(':')[0] || '9');
      const endHour = parseInt(workEnd.split(':')[0] || '17');
      const targetHoursPerDay = endHour - startHour;
      const targetMinutesPerDay = targetHoursPerDay * 60;
      
      // Calculate week range
      const weekStart = startOfWeek(parseISO(weekStartDate), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      // Analyze load for each day
      const dayLoads: DayLoad[] = [];
      
      for (let date = weekStart; date <= weekEnd; date = addDays(date, 1)) {
        // Skip weekends if not included
        if (!includeWeekends && (date.getDay() === 0 || date.getDay() === 6)) continue;
        
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Get schedule blocks
        const blocks = await scheduleService.getScheduleForDate(dateStr);
        
        // Get calendar events
        const calendarResponse = await calendarService.listEvents({
          calendarId: 'primary',
          timeMin: `${dateStr}T00:00:00Z`,
          timeMax: `${dateStr}T23:59:59Z`,
        });
        const events = calendarResponse.items || [];
        
        // Calculate load metrics
        let totalMinutes = 0;
        let workMinutes = 0;
        let meetingMinutes = 0;
        let breakMinutes = 0;
        
        // Process blocks
        blocks.forEach(block => {
          const duration = differenceInMinutes(block.endTime, block.startTime);
          totalMinutes += duration;
          
          switch (block.type) {
            case 'work':
              workMinutes += duration;
              break;
            case 'meeting':
              meetingMinutes += duration;
              break;
            case 'break':
              breakMinutes += duration;
              break;
          }
        });
        
        // Process calendar events
        events.forEach((event: any) => {
          if (event.start?.dateTime && event.end?.dateTime) {
            const duration = differenceInMinutes(
              parseISO(event.end.dateTime),
              parseISO(event.start.dateTime)
            );
            totalMinutes += duration;
            meetingMinutes += duration;
          }
        });
        
        // Calculate load score (0-100)
        const loadScore = Math.min(100, Math.round((totalMinutes / targetMinutesPerDay) * 100));
        
        dayLoads.push({
          date: dateStr,
          totalMinutes,
          workMinutes,
          meetingMinutes,
          breakMinutes,
          loadScore,
          blocks: blocks.length + events.length,
        });
      }
      
      // Calculate variance
      const avgLoad = dayLoads.reduce((sum, day) => sum + day.totalMinutes, 0) / dayLoads.length;
      const variance = dayLoads.map(day => Math.abs(day.totalMinutes - avgLoad));
      const maxVariance = Math.max(...variance);
      const variancePercentage = (maxVariance / avgLoad) * 100;
      
      // Find overloaded and underloaded days
      const overloadedDays = dayLoads.filter(day => day.loadScore > 85);
      const underloadedDays = dayLoads.filter(day => day.loadScore < 60);
      
      // Generate balance suggestions
      const suggestions: BalanceSuggestion[] = [];
      
      for (const overDay of overloadedDays) {
        for (const underDay of underloadedDays) {
          // Get moveable items from overloaded day
          const overDayBlocks = await scheduleService.getScheduleForDate(overDay.date);
          
          // Find blocks that could be moved
          const moveableBlocks = overDayBlocks.filter(block => 
            block.type === 'work' && 
            !block.metadata?.fixed &&
            differenceInMinutes(block.endTime, block.startTime) <= 120 // Max 2 hours
          );
          
          if (moveableBlocks.length > 0) {
            const blockToMove = moveableBlocks[0];
            if (blockToMove) {
              const duration = differenceInMinutes(blockToMove.endTime, blockToMove.startTime);
              
              suggestions.push({
                type: 'move',
                fromDate: overDay.date,
                toDate: underDay.date,
                item: {
                  id: blockToMove.id,
                  title: blockToMove.title,
                  duration,
                  type: blockToMove.type,
                },
                impact: `Reduces ${format(parseISO(overDay.date), 'EEE')} load by ${Math.round(duration / 60)} hours`,
                feasibility: 'high',
              });
            }
          }
        }
      }
      
      // Add split suggestions for long blocks
      for (const day of overloadedDays) {
        const blocks = await scheduleService.getScheduleForDate(day.date);
        const longBlocks = blocks.filter(block => 
          differenceInMinutes(block.endTime, block.startTime) >= 180 // 3+ hours
        );
        
        longBlocks.forEach(block => {
          const duration = differenceInMinutes(block.endTime, block.startTime);
          suggestions.push({
            type: 'split',
            fromDate: day.date,
            toDate: day.date,
            item: {
              id: block.id,
              title: block.title,
              duration,
              type: block.type,
            },
            impact: 'Improves focus and reduces fatigue',
            feasibility: 'medium',
          });
        });
      }
      
      // Calculate balance score
      const balanceScore = Math.max(0, 100 - Math.round(variancePercentage));
      
      return buildToolResponse(
        toolOptions,
        {
          weekStartDate,
          dayLoads,
          statistics: {
            averageLoadMinutes: Math.round(avgLoad),
            averageLoadHours: Math.round(avgLoad / 60 * 10) / 10,
            maxVariancePercentage: Math.round(variancePercentage),
            balanceScore,
            overloadedDays: overloadedDays.length,
            underloadedDays: underloadedDays.length,
          },
          suggestions: suggestions.slice(0, 5),
        },
        {
          type: 'list',
          title: 'Workload Balance Analysis',
          description: `Balance score: ${balanceScore}% - ${overloadedDays.length} overloaded days`,
          priority: balanceScore < 70 ? 'high' : 'medium',
          components: dayLoads.map(day => ({
            type: 'progressIndicator',
            data: {
              label: `${format(parseISO(day.date), 'EEE MMM d')}: ${Math.round(day.totalMinutes / 60)}h`,
              percentage: day.loadScore,
              current: day.totalMinutes,
              total: targetMinutesPerDay,
              description: day.loadScore > 85 ? 'Overloaded' : day.loadScore < 60 ? 'Light' : 'Balanced',
            },
          })),
        },
        {
          suggestions: suggestions.length > 0 ? [
            'Move flexible tasks to lighter days',
            'Split long work blocks',
            'Delegate or defer non-critical tasks',
            'Protect underloaded days for deep work',
          ] : [
            'Schedule is well-balanced',
            'Maintain current distribution',
            'Consider batching similar tasks',
          ],
          notification: {
            show: true,
            type: balanceScore < 70 ? 'warning' : 'success',
            message: balanceScore < 70
              ? `Workload imbalance detected - ${Math.round(variancePercentage)}% variance`
              : 'Workload is well-balanced across the week',
            duration: 4000,
          },
          actions: suggestions.length > 0 ? [{
            id: 'apply-balance',
            label: 'Apply Top Suggestion',
            variant: 'primary',
            action: {
              type: 'message',
              message: suggestions[0] ? `${suggestions[0].type} "${suggestions[0].item.title}" from ${suggestions[0].fromDate} to ${suggestions[0].toDate}` : '',
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[BALANCE LOAD] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Load Balancing Failed',
          description: 'Could not analyze workload distribution.',
        }
      );
    }
  },
}); 