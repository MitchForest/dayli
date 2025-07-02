import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type TimeBlock } from '../../schemas/schedule.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

export const findTimeBlock = tool({
  description: 'Find a time block by time, title, or description. Use this before trying to move or delete blocks.',
  parameters: z.object({
    description: z.string().describe('Time (e.g., "7pm", "19:00"), title, or type of the block'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ description, date }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'findTimeBlock',
      operation: 'read' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      console.log(`[AI Tools] Finding block by description: "${description}" on ${targetDate}`);
      
      const blocks = await scheduleService.getScheduleForDate(targetDate);
      
      // Search for matching block
      const searchLower = description.toLowerCase();
      const found = blocks.find(block => {
        // Check title
        if (block.title.toLowerCase().includes(searchLower)) return true;
        
        // Check type
        if (block.type === searchLower) return true;
        
        // Check time (various formats)
        const blockTime = format(block.startTime, 'h:mm a').toLowerCase();
        const blockTime24 = format(block.startTime, 'HH:mm');
        const blockTimeNoSpace = format(block.startTime, 'h:mma').toLowerCase();
        
        if (blockTime.includes(searchLower) || 
            blockTime24.includes(searchLower) ||
            blockTimeNoSpace.includes(searchLower)) {
          return true;
        }
        
        // Check if search is just a number (hour)
        const hourMatch = searchLower.match(/^(\d{1,2})$/);
        if (hourMatch && hourMatch[1]) {
          const searchHour = parseInt(hourMatch[1], 10);
          const blockHour = block.startTime.getHours();
          const blockHour12 = blockHour > 12 ? blockHour - 12 : blockHour;
          return searchHour === blockHour || searchHour === blockHour12;
        }
        
        return false;
      });
      
      if (found) {
        const timeBlock: TimeBlock = {
          id: found.id,
          type: found.type as TimeBlock['type'],
          title: found.title,
          startTime: formatTime12Hour(found.startTime),
          endTime: formatTime12Hour(found.endTime),
          description: found.description,
        };
        
        return buildToolResponse(
          toolOptions,
          {
            blockId: found.id,
            block: timeBlock,
          },
          {
            type: 'card',
            title: 'Found Time Block',
            description: `Found "${found.title}" at ${formatTime12Hour(found.startTime)}`,
            priority: 'medium',
            components: [{
              type: 'scheduleBlock',
              data: timeBlock,
            }],
          },
          {
            suggestions: [
              'Move this block',
              'Delete this block',
              'View full schedule',
            ],
            actions: [
              {
                id: 'move-block',
                label: 'Move Block',
                icon: 'move',
                variant: 'primary',
                action: {
                  type: 'message',
                  message: `Move the ${found.title} block to a new time`,
                },
              },
              {
                id: 'delete-block',
                label: 'Delete Block',
                icon: 'trash',
                variant: 'danger',
                action: {
                  type: 'tool',
                  tool: 'deleteTimeBlock',
                  params: { blockId: found.id },
                },
              },
            ],
          }
        );
      }
      
      // Provide helpful error with available blocks
      const availableBlocks = blocks.map(b => ({
        id: b.id,
        title: b.title,
        type: b.type,
        time: formatTime12Hour(b.startTime),
      }));
      
      return buildErrorResponse(
        toolOptions,
        {
          code: 'BLOCK_NOT_FOUND',
          message: `No block found matching "${description}"`,
          availableBlocks,
        },
        {
          title: 'Block Not Found',
          description: `No block found matching "${description}". ${blocks.length > 0 ? 'Available blocks:' : 'No blocks scheduled for this date.'}`,
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
      
    } catch (error) {
      console.error('Error in findTimeBlock:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to find time block',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 