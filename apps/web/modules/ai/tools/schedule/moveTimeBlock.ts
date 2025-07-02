import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type TimeBlock, type ScheduleChange } from '../../schemas/schedule.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour, formatTimeRange } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';
import { toMilitaryTime, findBlockByFlexibleDescription, getSimilarBlockSuggestions } from '../../utils/time-parser';

// Helper to calculate end time based on duration
function calculateEndTime(startTime: string, originalBlock: any): string {
  const parts = startTime.split(':');
  const startHours = parseInt(parts[0] || '0', 10);
  const startMinutes = parseInt(parts[1] || '0', 10);
  const duration = (originalBlock.endTime.getTime() - originalBlock.startTime.getTime()) / (1000 * 60);
  const endMinutes = startMinutes + duration;
  const endHours = startHours + Math.floor(endMinutes / 60);
  return `${endHours.toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
}

export const moveTimeBlock = tool({
  description: 'Move an existing time block to a new time',
  parameters: z.object({
    blockDescription: z.string().describe('Description or title of the block to move'),
    newStartTime: z.string().describe('New start time in any format (e.g., "9am", "3:30 pm")'),
    newEndTime: z.string().describe('New end time in any format (e.g., "10am", "4:30 pm")'),
    date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ blockDescription, newStartTime, newEndTime, date }): Promise<UniversalToolResponse> => {
    const startTimeMs = Date.now();
    const toolOptions = {
      toolName: 'moveTimeBlock',
      operation: 'update' as const,
      resourceType: 'schedule' as const,
      startTime: startTimeMs,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
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
        // Get suggestions - show first 3 blocks
        const suggestions = schedule.slice(0, 3);
        
        return buildErrorResponse(
          toolOptions,
          { code: 'BLOCK_NOT_FOUND', message: 'Could not find a matching block' },
          {
            title: 'Block Not Found',
            description: `No block matching "${blockDescription}" found on ${targetDate}`,
            components: suggestions.map(block => ({
              type: 'scheduleBlock' as const,
              data: {
                id: block.id,
                type: block.type as TimeBlock['type'],
                title: block.title,
                startTime: formatTime12Hour(block.startTime),
                endTime: formatTime12Hour(block.endTime),
                description: block.description || undefined,
              },
            })),
          }
        );
      }
      
      // Parse new times using flexible parser
      const militaryStartTime = toMilitaryTime(newStartTime);
      const militaryEndTime = toMilitaryTime(newEndTime);
      
      // Get the existing block
      const existingBlock = await scheduleService.getTimeBlock(blockToMove.id);
      if (!existingBlock) {
        return buildErrorResponse(
          toolOptions,
          { code: 'BLOCK_NOT_FOUND', message: 'Time block not found' },
          { title: 'Block Not Found' }
        );
      }
      
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
        
        return buildErrorResponse(
          toolOptions,
          {
            code: 'TIME_CONFLICT',
            message: 'Cannot move block - time conflict detected',
            conflicts: conflictingBlocks.map(b => ({
              time: formatTimeRange(formatTime12Hour(b.startTime), formatTime12Hour(b.endTime)),
              title: b.title,
            })),
          },
          {
            title: 'Schedule Conflict',
            description: 'Cannot move block due to time conflicts with existing blocks.',
            components: conflictingBlocks.map(block => ({
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
      
      // Update the block
      const updated = await scheduleService.updateTimeBlock({
        id: blockToMove.id,
        startTime: militaryStartTime,
        endTime: militaryEndTime,
      });
      
      const previousState: TimeBlock = {
        id: existingBlock.id,
        type: existingBlock.type as TimeBlock['type'],
        title: existingBlock.title,
        startTime: formatTime12Hour(existingBlock.startTime),
        endTime: formatTime12Hour(existingBlock.endTime),
        description: existingBlock.description,
      };
      
      const newState: TimeBlock = {
        id: updated.id,
        type: updated.type as TimeBlock['type'],
        title: updated.title,
        startTime: formatTime12Hour(updated.startTime),
        endTime: formatTime12Hour(updated.endTime),
        description: updated.description,
      };
      
      const scheduleChange: ScheduleChange = {
        type: 'move',
        blockId: blockToMove.id,
        previousState,
        newState,
      };
      
      return buildToolResponse(
        toolOptions,
        scheduleChange,
        {
          type: 'card',
          title: 'Moved Time Block',
          description: `"${updated.title}" moved from ${formatTimeRange(previousState.startTime, previousState.endTime)} to ${formatTimeRange(newState.startTime, newState.endTime)}`,
          priority: 'medium',
          components: [{
            type: 'scheduleBlock',
            data: newState,
          }],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Time block moved successfully',
            duration: 3000,
          },
          suggestions: ['View updated schedule', 'Move another block', 'Undo move'],
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
      console.error('Error in moveTimeBlock:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to move time block',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 