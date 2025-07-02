import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type TimeBlock, type ScheduleChange } from '../../schemas/schedule.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour, formatTimeRange } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

// Helper to parse natural language times
function parseTimeToMilitary(timeStr: string): string | null {
  const cleaned = timeStr.toLowerCase().trim();
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  
  let hours = parseInt(match[1] || '0');
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const period = match[3];
  
  if (period === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period === 'am' && hours === 12) {
    hours = 0;
  }
  
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper to calculate end time based on duration
function calculateEndTime(startTime: string, existingBlock: any): string {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const startDate = typeof existingBlock.startTime === 'string' 
    ? new Date(existingBlock.startTime) 
    : existingBlock.startTime;
  const endDate = typeof existingBlock.endTime === 'string'
    ? new Date(existingBlock.endTime)
    : existingBlock.endTime;
  const duration = endDate.getTime() - startDate.getTime();
  const durationMinutes = Math.floor(duration / 60000);
  
  let endHours = startHours || 0;
  let endMinutes = (startMinutes || 0) + durationMinutes;
  
  while (endMinutes >= 60) {
    endHours++;
    endMinutes -= 60;
  }
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

export const moveTimeBlock = tool({
  description: 'Move an existing time block to a new time',
  parameters: z.object({
    blockId: z.string().optional().describe('The ID of the block to move'),
    blockDescription: z.string().optional().describe('Description of the block (time, title, or type)'),
    newStartTime: z.string().describe('New start time in HH:MM format or natural language (e.g., "2pm")'),
    newEndTime: z.string().optional().describe('New end time in HH:MM format or natural language'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
  }),
  execute: async ({ blockId, blockDescription, newStartTime, newEndTime, date }): Promise<UniversalToolResponse> => {
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
      
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
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
          return buildErrorResponse(
            toolOptions,
            {
              code: 'BLOCK_NOT_FOUND',
              message: `Could not find block matching "${blockDescription}"`,
              availableBlocks: blocks.map(b => `${format(b.startTime, 'h:mm a')} - ${b.title}`),
            },
            {
              title: 'Block Not Found',
              description: `No block found matching "${blockDescription}". Please check the schedule first.`,
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
      
      // Get the existing block
      const existingBlock = await scheduleService.getTimeBlock(actualBlockId);
      if (!existingBlock) {
        return buildErrorResponse(
          toolOptions,
          { code: 'BLOCK_NOT_FOUND', message: 'Time block not found' },
          { title: 'Block Not Found' }
        );
      }
      
      // Parse the new times
      const parsedStartTime = parseTimeToMilitary(newStartTime) || newStartTime;
      const parsedEndTime = newEndTime 
        ? (parseTimeToMilitary(newEndTime) || newEndTime) 
        : calculateEndTime(parsedStartTime, existingBlock);
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        parsedStartTime, 
        parsedEndTime, 
        targetDate,
        actualBlockId
      );
      
      if (hasConflict) {
        const conflicts = await scheduleService.getScheduleForDate(targetDate);
        const conflictingBlocks = conflicts.filter(block => {
          if (block.id === actualBlockId) return false;
          const blockStart = format(block.startTime, 'HH:mm');
          const blockEnd = format(block.endTime, 'HH:mm');
          return (parsedStartTime < blockEnd && parsedEndTime > blockStart);
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
        id: actualBlockId,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
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
        blockId: actualBlockId,
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