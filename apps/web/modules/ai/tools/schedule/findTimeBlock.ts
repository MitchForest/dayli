import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

export const findTimeBlock = tool({
  description: 'Find a time block by time, title, or description. Use this before trying to move or delete blocks.',
  parameters: z.object({
    description: z.string().describe('Time (e.g., "7pm", "19:00"), title, or type of the block'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ description, date }) => {
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
        const result = {
          blockId: found.id,
          block: {
            id: found.id,
            type: found.type,
            title: found.title,
            startTime: format(found.startTime, 'HH:mm'),
            endTime: format(found.endTime, 'HH:mm'),
            time: `${format(found.startTime, 'h:mm a')} - ${format(found.endTime, 'h:mm a')}`
          }
        };
        
        return toolSuccess(result, {
          type: 'text',
          content: `Found block: ${found.title} at ${format(found.startTime, 'h:mm a')}`
        }, {
          suggestions: [
            'Move this block',
            'Delete this block',
            'View full schedule'
          ]
        });
      }
      
      // Provide helpful error with available blocks
      const availableBlocks = blocks.map(b => 
        `• ${format(b.startTime, 'h:mm a')} - ${b.title} (${b.type})`
      );
      
      return toolError(
        'BLOCK_NOT_FOUND',
        `No block found matching "${description}". Available blocks:\n${availableBlocks.join('\n') || 'No blocks scheduled for this date.'}`,
        { 
          availableBlocks: blocks.map(b => ({
            id: b.id,
            title: b.title,
            type: b.type,
            time: format(b.startTime, 'h:mm a')
          }))
        }
      );
      
    } catch (error) {
      console.error('Error in findTimeBlock:', error);
      return toolError(
        'FIND_BLOCK_FAILED',
        `Failed to find time block: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 