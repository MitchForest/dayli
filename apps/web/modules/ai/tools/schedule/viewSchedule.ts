import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ScheduleViewResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { getTasksForTimeBlock } from '@repo/database/queries';
import { createServerActionClient } from '@/lib/supabase-server';

export const viewSchedule = registerTool(
  createTool<typeof parameters, ScheduleViewResponse>({
    name: 'schedule_viewSchedule',
    description: 'View the schedule for a specific date with all time blocks and assigned tasks',
    parameters: z.object({
      date: z.string().describe('Date in YYYY-MM-DD format'),
    }),
    metadata: {
      category: 'schedule',
      displayName: 'View Schedule',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ date }) => {
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      console.log('[Tool: viewSchedule] Getting schedule for date:', date);
      
      const blocks = await scheduleService.getScheduleForDate(date);
      
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
      
      // Calculate statistics
      const totalHours = blocks.reduce((sum, block) => {
        const duration = block.endTime.getTime() - block.startTime.getTime();
        return sum + (duration / (1000 * 60 * 60));
      }, 0);
      
      const stats = {
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
        utilization: Math.round((blocks.length > 0 ? totalHours / 8 : 0) * 100),
      };
      
      // Return pure data
      return {
        success: true,
        date: date,
        blocks: blocksWithTasks.map(block => ({
          id: block.id,
          type: block.type as 'work' | 'meeting' | 'email' | 'break' | 'blocked',
          title: block.title,
          startTime: block.startTime.toISOString(),
          endTime: block.endTime.toISOString(),
          description: block.description,
          tasks: (block as any).tasks?.map((task: any) => ({
            id: task.id,
            title: task.title,
            completed: task.status === 'completed' || task.completed || false,
            estimatedMinutes: task.estimatedMinutes || 30,
          })),
        })),
        stats,
      };
    },
  })
);

const parameters = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
}); 