import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type ScheduleData, type TimeBlock } from '../../schemas/schedule.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';
import { getTasksForTimeBlock } from '@repo/database/queries';
import { createServerActionClient } from '@/lib/supabase-server';

export const getSchedule = tool({
  description: 'Get the current schedule for a specific date',
  parameters: z.object({
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ date }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'getSchedule',
      operation: 'read' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      console.log('[AI Tools] Getting schedule for date:', targetDate);
      
      const blocks = await scheduleService.getScheduleForDate(targetDate);
      
      // Get supabase client for database queries
      const supabase = await createServerActionClient();
      
      // Get tasks for each block
      const blocksWithTasks = await Promise.all(
        blocks.map(async (block) => {
          // Only fetch tasks for work and email blocks
          if (block.type === 'work' || block.type === 'email') {
            const tasks = await getTasksForTimeBlock(block.id, supabase);
            return { ...block, tasks };
          }
          return block;
        })
      );
      
      // Convert to structured format
      const formattedBlocks: TimeBlock[] = blocksWithTasks.map(block => ({
        id: block.id,
        type: block.type as TimeBlock['type'],
        title: block.title,
        startTime: formatTime12Hour(block.startTime),
        endTime: formatTime12Hour(block.endTime),
        description: block.description,
        tasks: (block as any).tasks?.map((task: any) => ({
          id: task.id,
          title: task.title,
          estimatedMinutes: task.estimatedMinutes || 30,
          completed: task.status === 'completed' || task.completed || false,
        })),
      }));
      
      // Group blocks by time period
      const timePeriods = {
        morning: formattedBlocks.filter(b => {
          const hourStr = b.startTime?.split(':')[0];
          if (!hourStr) return false;
          const hour = parseInt(hourStr);
          return hour < 12;
        }),
        afternoon: formattedBlocks.filter(b => {
          const hourStr = b.startTime?.split(':')[0];
          if (!hourStr) return false;
          const hour = parseInt(hourStr);
          const isPM = b.startTime.includes('PM');
          return (hour >= 12 || (isPM && hour < 5));
        }),
        evening: formattedBlocks.filter(b => {
          const hourStr = b.startTime?.split(':')[0];
          if (!hourStr) return false;
          const hour = parseInt(hourStr);
          const isPM = b.startTime.includes('PM');
          return isPM && hour >= 5;
        }),
      };
      
      // Calculate statistics
      const totalHours = blocks.reduce((sum, block) => {
        const duration = block.endTime.getTime() - block.startTime.getTime();
        return sum + (duration / (1000 * 60 * 60));
      }, 0);
      
      const stats = {
        totalBlocks: blocks.length,
        totalHours,
        focusHours: blocks
          .filter(b => b.type === 'work')
          .reduce((sum, block) => {
            const duration = block.endTime.getTime() - block.startTime.getTime();
            return sum + (duration / (1000 * 60 * 60));
          }, 0),
        meetingHours: blocks
          .filter(b => b.type === 'meeting')
          .reduce((sum, block) => {
            const duration = block.endTime.getTime() - block.startTime.getTime();
            return sum + (duration / (1000 * 60 * 60));
          }, 0),
        breakHours: blocks
          .filter(b => b.type === 'break')
          .reduce((sum, block) => {
            const duration = block.endTime.getTime() - block.startTime.getTime();
            return sum + (duration / (1000 * 60 * 60));
          }, 0),
        utilization: Math.round((blocks.length > 0 ? totalHours / 8 : 0) * 100),
      };
      
      const scheduleData: ScheduleData = {
        date: targetDate,
        blocks: formattedBlocks,
        timePeriods,
        stats,
      };
      
      return buildToolResponse(
        toolOptions,
        scheduleData,
        {
          type: 'timeline',
          title: `Schedule for ${format(new Date(targetDate), 'EEEE, MMMM d')}`,
          description: blocks.length === 0 
            ? 'No blocks scheduled for this date.' 
            : `${blocks.length} blocks scheduled (${stats.totalHours.toFixed(1)} hours)`,
          priority: 'medium',
          components: formattedBlocks.map(block => ({
            type: 'scheduleBlock' as const,
            data: block,
          })),
        },
        {
          suggestions: blocks.length === 0
            ? ['Schedule my day', 'Create a work block', 'Add a meeting']
            : stats.breakHours > 0
            ? ['Add more tasks', 'Optimize schedule', 'Show tomorrow']
            : ['Add a break', 'Optimize schedule', 'Show tomorrow'],
          actions: [
            {
              id: 'add-block',
              label: 'Add Block',
              icon: 'plus',
              variant: 'primary' as const,
              action: {
                type: 'message' as const,
                message: 'Create a new time block',
              },
            },
            ...(blocks.length > 0 ? [{
              id: 'optimize',
              label: 'Optimize',
              icon: 'refresh',
              variant: 'secondary' as const,
              action: {
                type: 'tool' as const,
                tool: 'regenerateSchedule',
                params: { date: targetDate },
              },
            }] : []),
          ],
        }
      );
      
    } catch (error) {
      console.error('[AI Tools] Error in getSchedule:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to get schedule',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 