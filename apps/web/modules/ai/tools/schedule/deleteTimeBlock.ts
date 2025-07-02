import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, toolConfirmation } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { useScheduleStore } from '@/modules/schedule/store/scheduleStore';

// Helper to invalidate schedule after changes
function invalidateScheduleForDate(date: string) {
  const { invalidateSchedule } = useScheduleStore.getState();
  invalidateSchedule(date);
}

export const deleteTimeBlock = tool({
  description: 'Delete a time block from the schedule',
  parameters: z.object({
    blockId: z.string().optional().describe('The ID of the block to delete'),
    blockDescription: z.string().optional().describe('Description of the block (time, title, or type)'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
    reason: z.string().optional(),
    confirm: z.boolean().default(false).describe('Set to true to confirm deletion'),
  }),
  execute: async ({ blockId, blockDescription, date, reason, confirm }) => {
    try {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      console.log('[AI Tools] Delete request:', { blockId, blockDescription, date: targetDate });
      
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
          const availableBlocks = blocks.map(b => 
            `• ${format(b.startTime, 'h:mm a')} - ${b.title} (${b.type})`
          ).join('\n');
          
          return toolError(
            'BLOCK_NOT_FOUND',
            `Could not find block matching "${blockDescription}". Available blocks:\n${availableBlocks || 'No blocks scheduled for this date.'}`,
            { availableBlocks }
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
      
      // Get the block details before deleting
      const block = await scheduleService.getTimeBlock(actualBlockId);
      if (!block) {
        console.log('[AI Tools] Block not found:', actualBlockId);
        return toolError(
          'BLOCK_NOT_FOUND',
          'Time block not found. Please check the schedule first.'
        );
      }
      
      // Check if confirmation is needed
      if (!confirm) {
        const confirmationId = crypto.randomUUID();
        
        return toolConfirmation(
          {
            blockId: actualBlockId,
            block: {
              title: block.title,
              type: block.type,
              time: `${format(block.startTime, 'h:mm a')} - ${format(block.endTime, 'h:mm a')}`
            }
          },
          confirmationId,
          `Are you sure you want to delete "${block.title}" at ${format(block.startTime, 'h:mm a')}?`
        );
      }
      
      // Delete the block
      await scheduleService.deleteTimeBlock(actualBlockId);
      
      invalidateScheduleForDate(targetDate);
      
      const result = {
        deleted: true,
        block: {
          title: block.title,
          type: block.type,
          time: format(block.startTime, 'h:mm a')
        },
        reason
      };
      
      return toolSuccess(result, {
        type: 'text',
        content: `Deleted "${block.title}" at ${format(block.startTime, 'h:mm a')}${reason ? ` (${reason})` : ''}`
      }, {
        affectedItems: [actualBlockId],
        suggestions: ['View updated schedule', 'Create new block', 'Undo deletion']
      });
      
    } catch (error) {
      console.error('Error in deleteTimeBlock:', error);
      return toolError(
        'BLOCK_DELETE_FAILED',
        `Failed to delete time block: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 