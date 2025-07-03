import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type DeleteTimeBlockResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { toMilitaryTime } from '../../utils/time-parser';

export const deleteTimeBlock = registerTool(
  createTool<typeof parameters, DeleteTimeBlockResponse>({
    name: 'schedule_deleteTimeBlock',
    description: 'Delete a time block from the schedule',
    parameters: z.object({
      blockDescription: z.string().describe('Description or title of the block to delete'),
      date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
    }),
    metadata: {
      category: 'schedule',
      displayName: 'Delete Time Block',
      requiresConfirmation: true,
      supportsStreaming: false,
    },
    execute: async ({ blockDescription, date }) => {
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Get current schedule
      const schedule = await scheduleService.getScheduleForDate(targetDate);
      
      // Find the block by searching through titles and times
      let blockToDelete = null;
      const searchLower = blockDescription.toLowerCase().trim();
      
      // First, try exact title match
      blockToDelete = schedule.find(block => 
        block.title.toLowerCase() === searchLower
      );
      
      // If not found, try partial matches and time references
      if (!blockToDelete) {
        // Check if searching by time
        const timeMatch = searchLower.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
        if (timeMatch && timeMatch[1]) {
          const searchTime = toMilitaryTime(timeMatch[1]);
          blockToDelete = schedule.find(block => {
            const blockStart = format(block.startTime, 'HH:mm');
            return blockStart === searchTime;
          });
        }
        
        // Try partial title match
        if (!blockToDelete) {
          blockToDelete = schedule.find(block => 
            block.title.toLowerCase().includes(searchLower) ||
            searchLower.includes(block.title.toLowerCase())
          );
        }
        
        // Try type match
        if (!blockToDelete) {
          blockToDelete = schedule.find(block => 
            block.type.toLowerCase() === searchLower
          );
        }
      }
      
      if (!blockToDelete) {
        return {
          success: false,
          error: `No block matching "${blockDescription}" found on ${targetDate}`,
          deletedBlockId: '',
          deletedBlockTitle: '',
        };
      }
      
      // Get the block details before deleting
      const block = await scheduleService.getTimeBlock(blockToDelete.id);
      if (!block) {
        return {
          success: false,
          error: 'Time block not found',
          deletedBlockId: blockToDelete.id,
          deletedBlockTitle: blockToDelete.title,
        };
      }
      
      // Delete the block
      await scheduleService.deleteTimeBlock(block.id);
      
      console.log(`[Tool: deleteTimeBlock] Deleted block ${block.id} for date: ${targetDate}`);
      
      // Return pure data
      return {
        success: true,
        deletedBlockId: block.id,
        deletedBlockTitle: block.title,
      };
    },
  })
);

const parameters = z.object({
  blockDescription: z.string().describe('Description or title of the block to delete'),
  date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
}); 