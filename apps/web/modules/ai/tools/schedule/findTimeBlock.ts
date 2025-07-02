import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type TimeBlock } from '../../schemas/schedule.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, parseISO } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';
import { toMilitaryTime } from '../../utils/time-parser';

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
      
      // Get current schedule
      const blocks = await scheduleService.getScheduleForDate(targetDate);
      
      if (blocks.length === 0) {
        return buildToolResponse(
          toolOptions,
          { blocks: [], query: description },
          {
            type: 'list',
            title: 'No Blocks Found',
            description: `No time blocks scheduled for ${targetDate}`,
            priority: 'low',
            components: [],
          },
          {
            suggestions: ['View another date', 'Create a new block'],
          }
        );
      }
      
      // Find matching blocks using flexible search
      const searchLower = description.toLowerCase().trim();
      const matchingBlocks: Array<{
        id: string;
        title: string;
        type: TimeBlock['type'];
        startTime: string;
        endTime: string;
        description?: string;
        metadata?: Record<string, any>;
      }> = [];
      
      // First, try exact title match
      const exactMatches = blocks.filter(block => 
        block.title.toLowerCase() === searchLower
      );
      matchingBlocks.push(...exactMatches.map(block => ({
        id: block.id,
        title: block.title,
        type: block.type,
        startTime: format(block.startTime, 'HH:mm'),
        endTime: format(block.endTime, 'HH:mm'),
        description: block.description,
        metadata: block.metadata,
      })));
      
      // If not found, check if searching by time
      if (matchingBlocks.length === 0) {
        const timeMatch = searchLower.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
        if (timeMatch && timeMatch[1]) {
          const searchTime = toMilitaryTime(timeMatch[1]);
          const timeMatches = blocks.filter(block => {
            const blockStart = format(block.startTime, 'HH:mm');
            return blockStart === searchTime;
          });
          matchingBlocks.push(...timeMatches.map(block => ({
            id: block.id,
            title: block.title,
            type: block.type,
            startTime: format(block.startTime, 'HH:mm'),
            endTime: format(block.endTime, 'HH:mm'),
            description: block.description,
            metadata: block.metadata,
          })));
        }
      }
      
      // If still not found, try partial title matches
      if (matchingBlocks.length === 0) {
        const partialMatches = blocks.filter(block =>
          block.title.toLowerCase().includes(searchLower)
        );
        matchingBlocks.push(...partialMatches.map(block => ({
          id: block.id,
          title: block.title,
          type: block.type,
          startTime: format(block.startTime, 'HH:mm'),
          endTime: format(block.endTime, 'HH:mm'),
          description: block.description,
          metadata: block.metadata,
        })));
      }
      
      // If still not found, try by type
      if (matchingBlocks.length === 0) {
        const typeMatches = blocks.filter(block =>
          block.type === searchLower
        );
        matchingBlocks.push(...typeMatches.map(block => ({
          id: block.id,
          title: block.title,
          type: block.type,
          startTime: format(block.startTime, 'HH:mm'),
          endTime: format(block.endTime, 'HH:mm'),
          description: block.description,
          metadata: block.metadata,
        })));
      }
      
      // Last resort: search in description
      if (matchingBlocks.length === 0 && searchLower.length > 2) {
        const descMatches = blocks.filter(block =>
          block.description?.toLowerCase().includes(searchLower)
        );
        matchingBlocks.push(...descMatches.map(block => ({
          id: block.id,
          title: block.title,
          type: block.type,
          startTime: format(block.startTime, 'HH:mm'),
          endTime: format(block.endTime, 'HH:mm'),
          description: block.description,
          metadata: block.metadata,
        })));
      }
      
      if (matchingBlocks.length > 0) {
        const firstMatch = matchingBlocks[0]!; // We know it exists because length > 0
        return buildToolResponse(
          toolOptions,
          { 
            blocks: [{
              id: firstMatch.id,
              type: firstMatch.type,
              title: firstMatch.title,
              startTime: formatTime12Hour(parseISO(`2024-01-01T${firstMatch.startTime}:00`)),
              endTime: formatTime12Hour(parseISO(`2024-01-01T${firstMatch.endTime}:00`)),
              description: firstMatch.description,
            }], 
            query: description 
          },
          {
            type: 'card',
            title: 'Block Found',
            description: `Found "${firstMatch.title}" at ${formatTime12Hour(parseISO(`2024-01-01T${firstMatch.startTime}:00`))}`,
            priority: 'low',
            components: [{
              type: 'scheduleBlock',
              data: {
                id: firstMatch.id,
                type: firstMatch.type,
                title: firstMatch.title,
                startTime: formatTime12Hour(parseISO(`2024-01-01T${firstMatch.startTime}:00`)),
                endTime: formatTime12Hour(parseISO(`2024-01-01T${firstMatch.endTime}:00`)),
                description: firstMatch.description,
                tasks: firstMatch.metadata?.tasks || undefined,
              },
            }],
          },
          {
            suggestions: matchingBlocks.length > 1 
              ? ['Show all matches', 'Filter by type'] 
              : ['Edit this block', 'Delete this block'],
            actions: [{
              id: 'move-block',
              label: 'Move Block',
              variant: 'primary',
              action: {
                type: 'message',
                message: `Move the ${firstMatch.title} block to a new time`,
              },
            }],
            notification: {
              show: true,
              type: 'success',
              message: `Found ${matchingBlocks.length} matching block${matchingBlocks.length > 1 ? 's' : ''}`,
              duration: 3000,
            },
            confirmationRequired: false,
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