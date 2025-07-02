import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, TimeBlock } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

// Helper to parse natural language times
function parseTimeToMilitary(timeStr: string): string | null {
  const cleaned = timeStr.toLowerCase().trim();
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
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper to calculate end time based on duration
function calculateEndTime(startTime: string, existingBlock: TimeBlock): string {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const startDate = typeof existingBlock.startTime === 'string' 
    ? new Date(existingBlock.startTime) 
    : existingBlock.startTime;
  const endDate = typeof existingBlock.endTime === 'string'
    ? new Date(existingBlock.endTime)
    : existingBlock.endTime;
  const duration = endDate.getTime() - startDate.getTime();
  const durationMinutes = Math.floor(duration / 60000);
  
  let endHours = startHours || 0;
  let endMinutes = (startMinutes || 0) + durationMinutes;
  
  while (endMinutes >= 60) {
    endHours++;
    endMinutes -= 60;
  }
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

export const moveTimeBlock = tool({
  description: 'Move an existing time block to a new time',
  parameters: z.object({
    blockId: z.string().optional().describe('The ID of the block to move'),
    blockDescription: z.string().optional().describe('Description of the block (time, title, or type)'),
    newStartTime: z.string().describe('New start time in HH:MM format or natural language (e.g., "2pm")'),
    newEndTime: z.string().optional().describe('New end time in HH:MM format or natural language'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ blockId, blockDescription, newStartTime, newEndTime, date }) => {
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Find the block if description provided
      let actualBlockId = blockId;
      if (!actualBlockId && blockDescription) {
        const blocks = await scheduleService.getScheduleForDate(targetDate);
        const found = blocks.find(b => 
          b.title.toLowerCase().includes(blockDescription.toLowerCase()) ||
          b.type === blockDescription.toLowerCase() ||
          format(b.startTime, 'h:mm a').includes(blockDescription)
        );
        
        if (!found) {
          return toolError(
            'BLOCK_NOT_FOUND',
            `Could not find block matching "${blockDescription}". Please check the schedule first.`,
            { availableBlocks: blocks.map(b => `${format(b.startTime, 'h:mm a')} - ${b.title}`) }
          );
        }
        actualBlockId = found.id;
      }
      
      if (!actualBlockId) {
        return toolError(
          'MISSING_IDENTIFIER',
          'Please provide either blockId or blockDescription'
        );
      }
      
      // Get the existing block
      const existingBlock = await scheduleService.getTimeBlock(actualBlockId);
      if (!existingBlock) {
        return toolError(
          'BLOCK_NOT_FOUND',
          'Time block not found'
        );
      }
      
      // Parse the new times
      const parsedStartTime = parseTimeToMilitary(newStartTime) || newStartTime;
      const parsedEndTime = newEndTime 
        ? (parseTimeToMilitary(newEndTime) || newEndTime) 
        : calculateEndTime(parsedStartTime, existingBlock);
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        parsedStartTime, 
        parsedEndTime, 
        targetDate,
        actualBlockId
      );
      
      if (hasConflict) {
        const conflicts = await scheduleService.getScheduleForDate(targetDate);
        const conflictingBlocks = conflicts.filter(block => {
          if (block.id === actualBlockId) return false;
          const blockStart = format(block.startTime, 'HH:mm');
          const blockEnd = format(block.endTime, 'HH:mm');
          return (parsedStartTime < blockEnd && parsedEndTime > blockStart);
        });
        
        return toolError(
          'TIME_CONFLICT',
          'Cannot move block - time conflict detected',
          { 
            conflicts: conflictingBlocks.map(b => ({
              time: `${format(b.startTime, 'h:mm a')}-${format(b.endTime, 'h:mm a')}`,
              title: b.title
            }))
          }
        );
      }
      
      // Update the block
      const updated = await scheduleService.updateTimeBlock({
        id: actualBlockId,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
      });
      
      const result = {
        id: updated.id,
        title: updated.title,
        type: updated.type,
        oldTime: {
          start: format(existingBlock.startTime, 'h:mm a'),
          end: format(existingBlock.endTime, 'h:mm a')
        },
        newTime: {
          start: parsedStartTime,
          end: parsedEndTime,
          display: `${format(new Date(`2000-01-01 ${parsedStartTime}`), 'h:mm a')} - ${format(new Date(`2000-01-01 ${parsedEndTime}`), 'h:mm a')}`
        }
      };
      
      return toolSuccess(result, {
        type: 'text',
        content: `Moved "${updated.title}" from ${result.oldTime.start} to ${result.newTime.display}`
      }, {
        affectedItems: [actualBlockId],
        suggestions: ['View updated schedule', 'Move another block', 'Undo move']
      });
      
    } catch (error) {
      console.error('Error in moveTimeBlock:', error);
      return toolError(
        'BLOCK_MOVE_FAILED',
        `Failed to move time block: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 