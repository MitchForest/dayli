import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type MoveTimeBlockResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { toMilitaryTime } from '../../utils/time-parser';

export const moveTimeBlock = registerTool(
  createTool<typeof parameters, MoveTimeBlockResponse>({
    name: 'schedule_moveTimeBlock',
    description: 'Move an existing time block to a new time',
    parameters: z.object({
      blockDescription: z.string().describe('Description or title of the block to move'),
      newStartTime: z.string().describe('New start time in any format (e.g., "9am", "3:30 pm")'),
      newEndTime: z.string().describe('New end time in any format (e.g., "10am", "4:30 pm")'),
      date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
    }),
    metadata: {
      category: 'schedule',
      displayName: 'Move Time Block',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ blockDescription, newStartTime, newEndTime, date }) => {
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Get current schedule
      const schedule = await scheduleService.getScheduleForDate(targetDate);
      
      // Find the block by searching through titles and times
      let blockToMove = null;
      const searchLower = blockDescription.toLowerCase().trim();
      
      // First, try exact title match
      blockToMove = schedule.find(block => 
        block.title.toLowerCase() === searchLower
      );
      
      // If not found, try partial matches and time references
      if (!blockToMove) {
        // Check if searching by time
        const timeMatch = searchLower.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
        if (timeMatch && timeMatch[1]) {
          const searchTime = toMilitaryTime(timeMatch[1]);
          blockToMove = schedule.find(block => {
            const blockStart = format(block.startTime, 'HH:mm');
            return blockStart === searchTime;
          });
        }
        
        // Try partial title match
        if (!blockToMove) {
          blockToMove = schedule.find(block => 
            block.title.toLowerCase().includes(searchLower) ||
            searchLower.includes(block.title.toLowerCase())
          );
        }
        
        // Try type match
        if (!blockToMove) {
          blockToMove = schedule.find(block => 
            block.type.toLowerCase() === searchLower
          );
        }
      }
      
      if (!blockToMove) {
        return {
          success: false,
          error: `No block matching "${blockDescription}" found on ${targetDate}`,
          block: {
            id: '',
            title: blockDescription,
            startTime: new Date(),
            endTime: new Date(),
            type: 'work',
          },
          previousTime: {
            startTime: new Date(),
            endTime: new Date(),
          },
        };
      }
      
      // Parse new times using flexible parser
      const militaryStartTime = toMilitaryTime(newStartTime);
      const militaryEndTime = toMilitaryTime(newEndTime);
      
      // Get the existing block
      const existingBlock = await scheduleService.getTimeBlock(blockToMove.id);
      if (!existingBlock) {
        return {
          success: false,
          error: 'Time block not found',
          block: {
            id: blockToMove.id,
            title: blockToMove.title,
            startTime: new Date(),
            endTime: new Date(),
            type: blockToMove.type,
          },
          previousTime: {
            startTime: new Date(),
            endTime: new Date(),
          },
        };
      }
      
      // Store previous times
      const previousTime = {
        startTime: existingBlock.startTime,
        endTime: existingBlock.endTime,
      };
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        militaryStartTime, 
        militaryEndTime, 
        targetDate,
        blockToMove.id
      );
      
      if (hasConflict) {
        const conflicts = await scheduleService.getScheduleForDate(targetDate);
        const conflictingBlocks = conflicts.filter(block => {
          if (block.id === blockToMove.id) return false;
          const blockStart = format(block.startTime, 'HH:mm');
          const blockEnd = format(block.endTime, 'HH:mm');
          return (militaryStartTime < blockEnd && militaryEndTime > blockStart);
        });
        
        return {
          success: false,
          error: `Cannot move block - conflicts with ${conflictingBlocks.length} other block(s)`,
          block: {
            id: existingBlock.id,
            title: existingBlock.title,
            startTime: existingBlock.startTime,
            endTime: existingBlock.endTime,
            type: existingBlock.type,
          },
          previousTime,
        };
      }
      
      // Update the block
      const updated = await scheduleService.updateTimeBlock({
        id: blockToMove.id,
        startTime: militaryStartTime,
        endTime: militaryEndTime,
      });
      
      console.log(`[Tool: moveTimeBlock] Moved block ${updated.id} to ${militaryStartTime}-${militaryEndTime}`);
      
      // Return pure data
      return {
        success: true,
        block: {
          id: updated.id,
          title: updated.title,
          startTime: updated.startTime,
          endTime: updated.endTime,
          type: updated.type,
        },
        previousTime,
      };
    },
  })
);

const parameters = z.object({
  blockDescription: z.string().describe('Description or title of the block to move'),
  newStartTime: z.string().describe('New start time in any format (e.g., "9am", "3:30 pm")'),
  newEndTime: z.string().describe('New end time in any format (e.g., "10am", "4:30 pm")'),
  date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
}); 