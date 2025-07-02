import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, toolConfirmation } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, addMinutes } from 'date-fns';

export const scheduleMeeting = tool({
  description: "Schedule a new meeting with smart time finding",
  parameters: z.object({
    title: z.string(),
    attendees: z.array(z.string()).describe("Email addresses"),
    duration: z.number().default(30).describe("Duration in minutes"),
    description: z.string().optional(),
    preferredTimes: z.array(z.string()).optional().describe("Preferred time slots"),
    needsPrepTime: z.boolean().default(false),
  }),
  execute: async (params) => {
    try {
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // For now, use a simple implementation
      // In a real implementation, this would check attendee availability
      const now = new Date();
      const startTime = params.preferredTimes?.[0] 
        ? new Date(params.preferredTimes[0])
        : addMinutes(now, 60); // Default to 1 hour from now
      
      const endTime = addMinutes(startTime, params.duration);
      
      // Check for conflicts in local schedule
      const dateStr = format(startTime, 'yyyy-MM-dd');
      const timeStr = format(startTime, 'HH:mm');
      const endTimeStr = format(endTime, 'HH:mm');
      
      const hasConflict = await scheduleService.checkForConflicts(
        timeStr,
        endTimeStr,
        dateStr
      );
      
      if (hasConflict) {
        return toolError(
          'TIME_CONFLICT',
          'The selected time has conflicts. Please choose a different time.',
          { suggestedTimes: ['2pm tomorrow', '9am next Monday'] }
        );
      }
      
      // Create the meeting
      const meeting = await calendarService.createEvent({
        summary: params.title,
        description: params.description,
        start: startTime,
        end: endTime,
        attendees: params.attendees.map(email => ({ email })),
      });
      
      // Add prep time if needed
      let prepBlockId: string | null = null;
      if (params.needsPrepTime) {
        const prepDuration = Math.min(15, params.duration / 2);
        const prepStart = addMinutes(startTime, -prepDuration);
        
        try {
          const prepBlock = await scheduleService.createTimeBlock({
            type: 'blocked',
            title: `Prep: ${params.title}`,
            startTime: format(prepStart, 'HH:mm'),
            endTime: timeStr,
            date: dateStr,
            description: `Preparation time for ${params.title}`,
          });
          prepBlockId = prepBlock.id;
        } catch (error) {
          console.warn('Failed to create prep block:', error);
        }
      }
      
      const result = {
        meeting: {
          id: meeting.id,
          title: meeting.summary,
          start: format(startTime, 'h:mm a'),
          end: format(endTime, 'h:mm a'),
          date: format(startTime, 'MMM d, yyyy'),
          attendees: params.attendees
        },
        prepTimeAdded: !!prepBlockId
      };
      
      return toolSuccess(result, {
        type: 'text',
        content: `Scheduled "${params.title}" for ${result.meeting.date} at ${result.meeting.start}${params.needsPrepTime ? ' (with prep time)' : ''}`
      }, {
        affectedItems: prepBlockId ? [meeting.id, prepBlockId] : [meeting.id],
        suggestions: [
          'View calendar',
          'Add another meeting',
          'Send meeting agenda'
        ]
      });
      
    } catch (error) {
      return toolError(
        'MEETING_SCHEDULE_FAILED',
        `Failed to schedule meeting: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 