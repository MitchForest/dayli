import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type MoveTimeBlockResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';

export const moveTimeBlock = registerTool(
  createTool<typeof parameters, MoveTimeBlockResponse>({
    name: 'schedule_moveTimeBlock',
    description: 'Move an existing time block to a new time - requires block ID and concrete times',
    parameters: z.object({
      blockId: z.string().describe('ID of the block to move'),
      newStartTime: z.string().describe('New start time in HH:MM format (24-hour)'),
      newEndTime: z.string().describe('New end time in HH:MM format (24-hour)'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
    }),
    metadata: {
      category: 'schedule',
      displayName: 'Move Time Block',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ blockId, newStartTime, newEndTime, date }) => {
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(newStartTime) || !timeRegex.test(newEndTime)) {
        throw new Error('Invalid time format. Expected HH:MM');
      }
      
      // Get the existing block
      const existingBlock = await scheduleService.getTimeBlock(blockId);
      if (!existingBlock) {
        return {
          success: false,
          error: 'Time block not found',
          block: {
            id: blockId,
            title: '',
            startTime: '',
            endTime: '',
            type: 'work',
          },
          previousTime: {
            startTime: '',
            endTime: '',
          },
        };
      }
      
      // Store previous times
      const previousTime = {
        startTime: existingBlock.startTime.toISOString(),
        endTime: existingBlock.endTime.toISOString(),
      };
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        newStartTime, 
        newEndTime, 
        date,
        blockId
      );
      
      if (hasConflict) {
        const conflicts = await scheduleService.getScheduleForDate(date);
        const conflictingBlocks = conflicts.filter(block => {
          if (block.id === blockId) return false;
          const blockStart = format(block.startTime, 'HH:mm');
          const blockEnd = format(block.endTime, 'HH:mm');
          return (newStartTime < blockEnd && newEndTime > blockStart);
        });
        
        return {
          success: false,
          error: `Cannot move block - conflicts with ${conflictingBlocks.length} other block(s)`,
          block: {
            id: existingBlock.id,
            title: existingBlock.title,
            startTime: existingBlock.startTime.toISOString(),
            endTime: existingBlock.endTime.toISOString(),
            type: existingBlock.type,
          },
          previousTime,
        };
      }
      
      // Update the block
      const updated = await scheduleService.updateTimeBlock({
        id: blockId,
        startTime: newStartTime,
        endTime: newEndTime,
      });
      
      console.log(`[Tool: moveTimeBlock] Moved block ${updated.id} to ${newStartTime}-${newEndTime}`);
      
      // Return pure data
      return {
        success: true,
        block: {
          id: updated.id,
          title: updated.title,
          startTime: updated.startTime.toISOString(),
          endTime: updated.endTime.toISOString(),
          type: updated.type,
        },
        previousTime,
      };
    },
  })
);

const parameters = z.object({
  blockId: z.string().describe('ID of the block to move'),
  newStartTime: z.string().describe('New start time in HH:MM format (24-hour)'),
  newEndTime: z.string().describe('New end time in HH:MM format (24-hour)'),
  date: z.string().describe('Date in YYYY-MM-DD format'),
}); 