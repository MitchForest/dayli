import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type TimeBlock, type ScheduleChange } from '../../schemas/schedule.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour, formatTimeRange } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';
import { toMilitaryTime } from '../../utils/time-parser';

export const createTimeBlock = tool({
  description: 'Create a new time block in the schedule',
  parameters: z.object({
    type: z.enum(['work', 'email', 'break', 'meeting', 'blocked']),
    title: z.string(),
    startTime: z.string().describe('Time in any format (e.g., "9am", "3:30 pm", "15:00")'),
    endTime: z.string().describe('Time in any format (e.g., "10am", "4:30 pm", "16:00")'),
    date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
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
      
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Parse times using flexible parser
      const militaryStartTime = toMilitaryTime(startTime);
      const militaryEndTime = toMilitaryTime(endTime);
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        militaryStartTime, 
        militaryEndTime, 
        targetDate
      );
      
      let conflictWarning = '';
      if (hasConflict) {
        // Get the current schedule to show what's overlapping
        const currentSchedule = await scheduleService.getScheduleForDate(targetDate);
        const overlappingBlocks = currentSchedule.filter(block => {
          const blockStart = format(block.startTime, 'HH:mm');
          const blockEnd = format(block.endTime, 'HH:mm');
          return (militaryStartTime < blockEnd && militaryEndTime > blockStart);
        });
        
        // Check if we're at the 4-block limit
        if (overlappingBlocks.length >= 4) {
          return buildErrorResponse(
            toolOptions,
            {
              code: 'MAX_OVERLAPS_REACHED',
              message: 'Maximum of 4 overlapping blocks reached',
              conflicts: overlappingBlocks.map(b => ({
                id: b.id,
                time: formatTimeRange(formatTime12Hour(b.startTime), formatTime12Hour(b.endTime)),
                title: b.title,
              })),
            },
            {
              title: 'Maximum Overlapping Blocks Reached',
              description: `Cannot create block from ${formatTimeRange(startTime, endTime)}. There are already 4 blocks scheduled during this time.`,
              components: overlappingBlocks.map(block => ({
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
        
        // Build conflict warning message
        conflictWarning = overlappingBlocks.length === 1 
          ? `Note: This overlaps with "${overlappingBlocks[0]?.title}" block`
          : `Note: This overlaps with ${overlappingBlocks.length} other blocks`;
      }
      
      // Create the time block
      const block = await scheduleService.createTimeBlock({
        type,
        title,
        startTime: militaryStartTime,
        endTime: militaryEndTime,
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
          description: `"${title}" scheduled for ${formatTimeRange(timeBlock.startTime, timeBlock.endTime)}${conflictWarning ? `. ${conflictWarning}` : ''}`,
          priority: conflictWarning ? 'high' : 'medium',
          components: [{
            type: 'scheduleBlock',
            data: timeBlock,
          }],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: conflictWarning || 'Time block created successfully',
            duration: conflictWarning ? 5000 : 3000,
          },
          suggestions: conflictWarning
            ? ['Move overlapping blocks', 'View full schedule', 'Adjust this block']
            : type === 'work'
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
            ...(conflictWarning ? [{
              id: 'resolve-conflicts',
              label: 'Resolve Overlaps',
              icon: 'shuffle',
              variant: 'secondary' as const,
              action: {
                type: 'message' as const,
                message: 'Help me reorganize the overlapping blocks',
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