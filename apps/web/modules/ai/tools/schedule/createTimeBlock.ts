import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type CreateTimeBlockResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';

export const createTimeBlock = registerTool(
  createTool<typeof parameters, CreateTimeBlockResponse>({
    name: 'schedule_createTimeBlock',
    description: 'Create a new time block in the schedule with concrete time values',
    parameters: z.object({
      type: z.enum(['work', 'email', 'break', 'meeting', 'blocked']),
      title: z.string(),
      startTime: z.string().describe('Start time in HH:MM format (24-hour)'),
      endTime: z.string().describe('End time in HH:MM format (24-hour)'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
      description: z.string().optional(),
    }),
    metadata: {
      category: 'schedule',
      displayName: 'Create Time Block',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ type, title, startTime, endTime, date, description }) => {
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        throw new Error('Invalid time format. Expected HH:MM');
      }
      
      // Check for conflicts
      const hasConflict = await scheduleService.checkForConflicts(
        startTime, 
        endTime, 
        date
      );
      
      let conflicts: CreateTimeBlockResponse['conflicts'] = undefined;
      
      if (hasConflict) {
        // Get the current schedule to show what's overlapping
        const currentSchedule = await scheduleService.getScheduleForDate(date);
        const overlappingBlocks = currentSchedule.filter(block => {
          const blockStart = format(block.startTime, 'HH:mm');
          const blockEnd = format(block.endTime, 'HH:mm');
          return (startTime < blockEnd && endTime > blockStart);
        });
        
        // Check if we're at the 4-block limit
        if (overlappingBlocks.length >= 4) {
          return {
            success: false,
            error: 'Maximum of 4 overlapping blocks reached. Cannot create this block.',
            block: {
              id: '',
              type,
              title,
              startTime: `${date}T${startTime}:00`,
              endTime: `${date}T${endTime}:00`,
              description,
            },
            conflicts: overlappingBlocks.map(b => ({
              id: b.id,
              title: b.title,
              startTime: b.startTime.toISOString(),
              endTime: b.endTime.toISOString(),
            })),
          };
        }
        
        conflicts = overlappingBlocks.map(b => ({
          id: b.id,
          title: b.title,
          startTime: b.startTime.toISOString(),
          endTime: b.endTime.toISOString(),
        }));
      }
      
      // Create the time block
      const block = await scheduleService.createTimeBlock({
        type,
        title,
        startTime,
        endTime,
        date,
        description,
      });
      
      console.log(`[Tool: createTimeBlock] Created block ${block.id} for date: ${date}`);
      
      // Return pure data
      return {
        success: true,
        block: {
          id: block.id,
          type: block.type as 'work' | 'meeting' | 'email' | 'break' | 'blocked',
          title: block.title,
          startTime: block.startTime.toISOString(),
          endTime: block.endTime.toISOString(),
          description: block.description,
        },
        conflicts,
      };
    },
  })
);

const parameters = z.object({
  type: z.enum(['work', 'email', 'break', 'meeting', 'blocked']),
  title: z.string(),
  startTime: z.string().describe('Start time in HH:MM format (24-hour)'),
  endTime: z.string().describe('End time in HH:MM format (24-hour)'),
  date: z.string().describe('Date in YYYY-MM-DD format'),
  description: z.string().optional(),
}); 