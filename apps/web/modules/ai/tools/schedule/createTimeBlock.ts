import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type CreateTimeBlockResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';
import { toMilitaryTime } from '../../utils/time-parser';

export const createTimeBlock = registerTool(
  createTool<typeof parameters, CreateTimeBlockResponse>({
    name: 'schedule_createTimeBlock',
    description: 'Create a new time block in the schedule',
    parameters: z.object({
      type: z.enum(['work', 'email', 'break', 'meeting', 'blocked']),
      title: z.string(),
      startTime: z.string().describe('Time in any format (e.g., "9am", "3:30 pm", "15:00")'),
      endTime: z.string().describe('Time in any format (e.g., "10am", "4:30 pm", "16:00")'),
      date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
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
      
      let conflicts: CreateTimeBlockResponse['conflicts'] = undefined;
      
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
          return {
            success: false,
            error: 'Maximum of 4 overlapping blocks reached. Cannot create this block.',
            block: {
              id: '',
              type,
              title,
              startTime: new Date(`${targetDate}T${militaryStartTime}`),
              endTime: new Date(`${targetDate}T${militaryEndTime}`),
              description,
            },
            conflicts: overlappingBlocks.map(b => ({
              id: b.id,
              title: b.title,
              startTime: b.startTime,
              endTime: b.endTime,
            })),
          };
        }
        
        conflicts = overlappingBlocks.map(b => ({
          id: b.id,
          title: b.title,
          startTime: b.startTime,
          endTime: b.endTime,
        }));
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
      
      console.log(`[Tool: createTimeBlock] Created block ${block.id} for date: ${targetDate}`);
      
      // Return pure data
      return {
        success: true,
        block: {
          id: block.id,
          type: block.type as 'work' | 'meeting' | 'email' | 'break' | 'blocked',
          title: block.title,
          startTime: block.startTime,
          endTime: block.endTime,
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
  startTime: z.string().describe('Time in any format (e.g., "9am", "3:30 pm", "15:00")'),
  endTime: z.string().describe('Time in any format (e.g., "10am", "4:30 pm", "16:00")'),
  date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
  description: z.string().optional(),
}); 