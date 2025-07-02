import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type TimeBlock, type ScheduleChange } from '../../schemas/schedule.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

export const deleteTimeBlock = tool({
  description: 'Delete a time block from the schedule',
  parameters: z.object({
    blockId: z.string().optional().describe('The ID of the block to delete'),
    blockDescription: z.string().optional().describe('Description of the block (time, title, or type)'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
    reason: z.string().optional(),
    confirm: z.boolean().default(false).describe('Set to true to confirm deletion'),
  }),
  execute: async ({ blockId, blockDescription, date, reason, confirm }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'deleteTimeBlock',
      operation: 'delete' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
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
          );
          
          return buildErrorResponse(
            toolOptions,
            {
              code: 'BLOCK_NOT_FOUND',
              message: `Could not find block matching "${blockDescription}"`,
              availableBlocks,
            },
            {
              title: 'Block Not Found',
              description: `No block found matching "${blockDescription}". ${availableBlocks.length > 0 ? 'Available blocks:' : 'No blocks scheduled for this date.'}`,
              components: blocks.map(block => ({
                type: 'scheduleBlock' as const,
                data: {
                  id: block.id,
                  type: block.type as TimeBlock['type'],
                  title: block.title,
                  startTime: formatTime12Hour(block.startTime),
                  endTime: formatTime12Hour(block.endTime),
                  description: block.description,
                },
              })),
            }
          );
        }
        actualBlockId = found.id;
      }
      
      if (!actualBlockId) {
        return buildErrorResponse(
          toolOptions,
          { code: 'MISSING_IDENTIFIER', message: 'Please provide either blockId or blockDescription' },
          { title: 'Missing Block Identifier' }
        );
      }
      
      // Get the block details before deleting
      const block = await scheduleService.getTimeBlock(actualBlockId);
      if (!block) {
        console.log('[AI Tools] Block not found:', actualBlockId);
        return buildErrorResponse(
          toolOptions,
          { code: 'BLOCK_NOT_FOUND', message: 'Time block not found' },
          { title: 'Block Not Found', description: 'Time block not found. Please check the schedule first.' }
        );
      }
      
      // Check if confirmation is needed
      if (!confirm) {
        const confirmationId = crypto.randomUUID();
        
        const blockData: TimeBlock = {
          id: block.id,
          type: block.type as TimeBlock['type'],
          title: block.title,
          startTime: formatTime12Hour(block.startTime),
          endTime: formatTime12Hour(block.endTime),
          description: block.description,
        };
        
        return buildToolResponse(
          toolOptions,
          { blockId: actualBlockId, block: blockData },
          {
            type: 'confirmation',
            title: 'Confirm Deletion',
            description: `Are you sure you want to delete "${block.title}" at ${formatTime12Hour(block.startTime)}?`,
            priority: 'high',
            components: [{
              type: 'scheduleBlock',
              data: blockData,
            }],
          },
          {
            confirmationRequired: true,
            confirmationId,
            actions: [
              {
                id: 'confirm-delete',
                label: 'Delete Block',
                icon: 'trash',
                variant: 'danger',
                action: {
                  type: 'tool',
                  tool: 'deleteTimeBlock',
                  params: { blockId: actualBlockId, confirm: true, reason },
                },
              },
              {
                id: 'cancel',
                label: 'Cancel',
                variant: 'secondary',
                action: {
                  type: 'message',
                  message: 'Cancelled deletion',
                },
              },
            ],
          }
        );
      }
      
      // Delete the block
      await scheduleService.deleteTimeBlock(actualBlockId);
      
      console.log(`[AI Tools] Deleted block ${actualBlockId} for date: ${targetDate}`);
      
      const previousState: TimeBlock = {
        id: block.id,
        type: block.type as TimeBlock['type'],
        title: block.title,
        startTime: formatTime12Hour(block.startTime),
        endTime: formatTime12Hour(block.endTime),
        description: block.description,
      };
      
      const scheduleChange: ScheduleChange = {
        type: 'remove',
        blockId: actualBlockId,
        previousState,
        reason,
      };
      
      return buildToolResponse(
        toolOptions,
        scheduleChange,
        {
          type: 'card',
          title: 'Deleted Time Block',
          description: `"${block.title}" at ${formatTime12Hour(block.startTime)} has been deleted${reason ? ` (${reason})` : ''}`,
          priority: 'medium',
          components: [],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Time block deleted successfully',
            duration: 3000,
          },
          suggestions: ['View updated schedule', 'Create new block', 'Undo deletion'],
          actions: [{
            id: 'view-schedule',
            label: 'View Schedule',
            icon: 'calendar',
            variant: 'primary',
            action: {
              type: 'tool',
              tool: 'getSchedule',
              params: { date: targetDate },
            },
          }],
        }
      );
      
    } catch (error) {
      console.error('Error in deleteTimeBlock:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to delete time block',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 