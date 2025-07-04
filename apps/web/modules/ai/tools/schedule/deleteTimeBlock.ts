import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type DeleteTimeBlockResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

export const deleteTimeBlock = registerTool(
  createTool<typeof parameters, DeleteTimeBlockResponse>({
    name: 'schedule_deleteTimeBlock',
    description: 'Delete a time block from the schedule - requires block ID',
    parameters: z.object({
      blockId: z.string().describe('ID of the block to delete'),
    }),
    metadata: {
      category: 'schedule',
      displayName: 'Delete Time Block',
      requiresConfirmation: true,
      supportsStreaming: false,
    },
    execute: async ({ blockId }) => {
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Get the block details before deleting
      const block = await scheduleService.getTimeBlock(blockId);
      if (!block) {
        return {
          success: false,
          error: 'Time block not found',
          deletedBlockId: blockId,
          deletedBlockTitle: '',
        };
      }
      
      // Delete the block
      await scheduleService.deleteTimeBlock(blockId);
      
      console.log(`[Tool: deleteTimeBlock] Deleted block ${blockId}`);
      
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
  blockId: z.string().describe('ID of the block to delete'),
}); 