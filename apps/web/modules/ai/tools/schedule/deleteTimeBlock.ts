import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type TimeBlock, type ScheduleChange } from '../../schemas/schedule.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour, formatTimeRange } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { toMilitaryTime } from '../../utils/time-parser';

export const deleteTimeBlock = tool({
  description: 'Delete a time block from the schedule',
  parameters: z.object({
    blockDescription: z.string().describe('Description or title of the block to delete'),
    date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
    confirmationId: z.string().optional().describe('Confirmation ID for deletion'),
  }),
  execute: async ({ blockDescription, date, confirmationId }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'deleteTimeBlock',
      operation: 'delete' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
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
        return buildErrorResponse(
          toolOptions,
          { code: 'BLOCK_NOT_FOUND', message: 'Could not find a matching block' },
          {
            title: 'Block Not Found',
            description: `No block matching "${blockDescription}" found on ${targetDate}`,
          }
        );
      }
      
      // Get the block details before deleting
      const block = await scheduleService.getTimeBlock(blockToDelete.id);
      if (!block) {
        console.log('[AI Tools] Block not found:', blockToDelete.id);
        return buildErrorResponse(
          toolOptions,
          { code: 'BLOCK_NOT_FOUND', message: 'Time block not found' },
          { title: 'Block Not Found', description: 'Time block not found. Please check the schedule first.' }
        );
      }
      
      // Check if confirmation is needed
      if (!confirmationId) {
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
          { blockId: block.id, block: blockData },
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
                  params: { blockDescription, date, confirmationId },
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
      await scheduleService.deleteTimeBlock(block.id);
      
      console.log(`[AI Tools] Deleted block ${block.id} for date: ${targetDate}`);
      
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
        blockId: block.id,
        previousState,
        reason: blockDescription,
      };
      
      return buildToolResponse(
        toolOptions,
        scheduleChange,
        {
          type: 'card',
          title: 'Deleted Time Block',
          description: `"${block.title}" at ${formatTime12Hour(block.startTime)} has been deleted`,
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