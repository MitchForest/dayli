import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';

export const getSchedule = tool({
  description: 'Get the current schedule for a specific date',
  parameters: z.object({
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ date }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      console.log('[AI Tools] Getting schedule for date:', targetDate);
      
      const blocks = await scheduleService.getScheduleForDate(targetDate);
      
      console.log('[AI Tools] Retrieved blocks:', blocks.map(b => ({
        id: b.id,
        time: `${format(b.startTime, 'h:mm a')} - ${format(b.endTime, 'h:mm a')}`,
        title: b.title,
        type: b.type
      })));
      
      // Format blocks with both 12-hour and 24-hour times for flexibility
      const formattedBlocks = blocks.map(block => ({
        id: block.id,
        type: block.type,
        title: block.title,
        startTime: format(block.startTime, 'HH:mm'),
        endTime: format(block.endTime, 'HH:mm'),
        startTime12: format(block.startTime, 'h:mm a'),
        endTime12: format(block.endTime, 'h:mm a'),
        description: block.description
      }));
      
      // Calculate schedule statistics
      const stats = {
        totalBlocks: blocks.length,
        totalHours: blocks.reduce((sum, block) => {
          const duration = block.endTime.getTime() - block.startTime.getTime();
          return sum + (duration / (1000 * 60 * 60));
        }, 0),
        byType: {
          work: blocks.filter(b => b.type === 'work').length,
          meeting: blocks.filter(b => b.type === 'meeting').length,
          email: blocks.filter(b => b.type === 'email').length,
          break: blocks.filter(b => b.type === 'break').length,
          blocked: blocks.filter(b => b.type === 'blocked').length,
        },
        hasBreaks: blocks.some(b => b.type === 'break'),
        hasFocusTime: blocks.some(b => b.type === 'work'),
      };
      
      const result = {
        date: targetDate,
        blocks: formattedBlocks,
        stats,
        summary: blocks.length === 0 
          ? 'No blocks scheduled for this date.' 
          : `${blocks.length} blocks scheduled (${stats.totalHours.toFixed(1)} hours)`
      };
      
      return toolSuccess(result, {
        type: 'schedule',
        content: formattedBlocks
      }, {
        suggestions: blocks.length === 0
          ? ['Schedule my day', 'Create a work block', 'Add a meeting']
          : stats.hasBreaks
          ? ['Add more tasks', 'Optimize schedule', 'Show tomorrow']
          : ['Add a break', 'Optimize schedule', 'Show tomorrow']
      });
      
    } catch (error) {
      console.error('[AI Tools] Error in getSchedule:', error);
      return toolError(
        'SCHEDULE_FETCH_FAILED',
        `Failed to get schedule: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 