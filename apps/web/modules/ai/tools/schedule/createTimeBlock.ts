import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore';

// Helper to parse natural language times
function parseTimeToMilitary(timeStr: string): string | null {
  const cleaned = timeStr.toLowerCase().trim();
  
  // Handle "2pm", "2:30pm", etc.
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  
  let hours = parseInt(match[1] || '0');
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const period = match[3];
  
  if (period === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period === 'am' && hours === 12) {
    hours = 0;
  }
  
  // Validate
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper to invalidate schedule after changes
function invalidateScheduleForDate(date: string) {
  const { invalidateSchedule } = useScheduleStore.getState();
  invalidateSchedule(date);
  console.log(`[AI Tools] Invalidated schedule for date: ${date}`);
}

export const createTimeBlock = tool({
  description: 'Create a new time block in the schedule',
  parameters: z.object({
    type: z.enum(['work', 'email', 'break', 'meeting', 'blocked']).describe('Type of time block'),
    title: z.string(),
    startTime: z.string().describe('Time in HH:MM format or natural language (e.g., "2pm", "14:00")'),
    endTime: z.string().describe('Time in HH:MM format or natural language'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
    description: z.string().optional(),
  }),
  execute: async ({ type, title, startTime, endTime, date, description }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Parse natural language times
      const parsedStartTime = parseTimeToMilitary(startTime) || startTime;
      const parsedEndTime = parseTimeToMilitary(endTime) || endTime;
      
      console.log('[AI Tools] Creating block:', { 
        type, 
        title, 
        startTime: `${startTime} -> ${parsedStartTime}`,
        endTime: `${endTime} -> ${parsedEndTime}`,
        date: targetDate 
      });
      
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        parsedStartTime, 
        parsedEndTime, 
        targetDate
      );
      
      if (hasConflict) {
        // Get the current schedule to show what's blocking
        const currentSchedule = await scheduleService.getScheduleForDate(targetDate);
        const blockingBlocks = currentSchedule.filter(block => {
          const blockStart = format(block.startTime, 'HH:mm');
          const blockEnd = format(block.endTime, 'HH:mm');
          return (parsedStartTime < blockEnd && parsedEndTime > blockStart);
        }).map(b => `${format(b.startTime, 'h:mm a')}-${format(b.endTime, 'h:mm a')} ${b.title}`);
        
        return toolError(
          'TIME_CONFLICT',
          `Time conflict detected. The following blocks overlap with ${parsedStartTime}-${parsedEndTime}:\n${blockingBlocks.join('\n')}`,
          { conflicts: blockingBlocks }
        );
      }
      
      // Create the block
      const block = await scheduleService.createTimeBlock({
        type,
        title,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        date: targetDate,
        description,
      });
      
      invalidateScheduleForDate(targetDate);
      
      const result = {
        id: block.id,
        type: block.type,
        title: block.title,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        date: targetDate
      };
      
      return toolSuccess(result, {
        type: 'schedule',
        content: [result]
      }, {
        affectedItems: [block.id],
        suggestions: type === 'work'
          ? ['Assign tasks to this block', 'Create another block', 'View schedule']
          : ['Create another block', 'View schedule', 'Move this block']
      });
      
    } catch (error) {
      console.error('[AI Tools] Error in createTimeBlock:', error);
      
      return toolError(
        'BLOCK_CREATE_FAILED',
        `Failed to create time block: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 