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
  
  // Handle "2pm", "2:30pm", etc.
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
  
  // Validate
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export const createTimeBlock = tool({
  description: 'Create a new time block in the schedule',
  parameters: z.object({
    type: z.enum(['work', 'email', 'break', 'meeting', 'blocked']).describe('Type of time block'),
    title: z.string(),
    startTime: z.string().describe('Time in HH:MM format or natural language (e.g., "2pm", "14:00")'),
    endTime: z.string().describe('Time in HH:MM format or natural language'),
    date: z.string().optional().describe('YYYY-MM-DD format, defaults to today'),
    description: z.string().optional(),
  }),
  execute: async ({ type, title, startTime, endTime, date, description }): Promise<UniversalToolResponse> => {
    const startTimeMs = Date.now();
    const toolOptions = {
      toolName: 'createTimeBlock',
      operation: 'create' as const,
      resourceType: 'schedule' as const,
      startTime: startTimeMs,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Parse natural language times
      const parsedStartTime = parseTimeToMilitary(startTime) || startTime;
      const parsedEndTime = parseTimeToMilitary(endTime) || endTime;
      
      console.log('[AI Tools] Creating block:', { 
        type, 
        title, 
        startTime: `${startTime} -> ${parsedStartTime}`,
        endTime: `${endTime} -> ${parsedEndTime}`,
        date: targetDate 
      });
      
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        parsedStartTime, 
        parsedEndTime, 
        targetDate
      );
      
      if (hasConflict) {
        // Get the current schedule to show what's blocking
        const currentSchedule = await scheduleService.getScheduleForDate(targetDate);
        const blockingBlocks = currentSchedule.filter(block => {
          const blockStart = format(block.startTime, 'HH:mm');
          const blockEnd = format(block.endTime, 'HH:mm');
          return (parsedStartTime < blockEnd && parsedEndTime > blockStart);
        });
        
        return buildErrorResponse(
          toolOptions,
          {
            code: 'TIME_CONFLICT',
            message: 'Time conflict detected',
            conflicts: blockingBlocks.map(b => ({
              id: b.id,
              time: formatTimeRange(formatTime12Hour(b.startTime), formatTime12Hour(b.endTime)),
              title: b.title,
            })),
          },
          {
            title: 'Schedule Conflict Detected',
            description: `Cannot create block from ${formatTimeRange(startTime, endTime)}. This time overlaps with existing blocks.`,
            components: blockingBlocks.map(block => ({
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
      
      // Create the block
      const block = await scheduleService.createTimeBlock({
        type,
        title,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        date: targetDate,
        description,
      });
      
      console.log(`[AI Tools] Created block ${block.id} for date: ${targetDate}`);
      
      const timeBlock: TimeBlock = {
        id: block.id,
        type: block.type as TimeBlock['type'],
        title: block.title,
        startTime: formatTime12Hour(block.startTime),
        endTime: formatTime12Hour(block.endTime),
        description: block.description,
      };
      
      const scheduleChange: ScheduleChange = {
        type: 'add',
        blockId: block.id,
        newState: timeBlock,
      };
      
      return buildToolResponse(
        toolOptions,
        scheduleChange,
        {
          type: 'card',
          title: `Created ${type} block`,
          description: `"${title}" scheduled for ${formatTimeRange(timeBlock.startTime, timeBlock.endTime)}`,
          priority: 'high',
          components: [{
            type: 'scheduleBlock',
            data: timeBlock,
          }],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Time block created successfully',
            duration: 3000,
          },
          suggestions: type === 'work'
            ? ['Assign tasks to this block', 'Create another block', 'View full schedule']
            : ['Create another block', 'View full schedule', 'Move this block'],
          actions: [
            {
              id: 'view-schedule',
              label: 'View Schedule',
              icon: 'calendar',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'getSchedule',
                params: { date: targetDate },
              },
            },
            ...(type === 'work' ? [{
              id: 'assign-tasks',
              label: 'Add Tasks',
              icon: 'plus',
              variant: 'secondary' as const,
              action: {
                type: 'message' as const,
                message: `Show me tasks I can add to the ${title} block`,
              },
            }] : []),
          ],
        }
      );
      
    } catch (error) {
      console.error('[AI Tools] Error in createTimeBlock:', error);
      
      // Handle authentication errors specifically
      if (error instanceof Error && error.message.includes('not configured')) {
        return buildErrorResponse(
          toolOptions,
          error,
          {
            title: 'Authentication Required',
            description: 'Please log in to use this feature',
          }
        );
      }
      
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to create time block',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 