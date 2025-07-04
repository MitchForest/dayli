import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ScheduleMeetingResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, addMinutes } from 'date-fns';

export const scheduleMeeting = registerTool(
  createTool<typeof parameters, ScheduleMeetingResponse>({
    name: 'calendar_scheduleMeeting',
    description: "Schedule a new meeting with concrete date and time values",
    parameters: z.object({
      title: z.string().describe("Meeting title"),
      attendees: z.array(z.string()).describe("Email addresses of attendees"),
      date: z.string().describe("Date in YYYY-MM-DD format"),
      startTime: z.string().describe("Start time in HH:MM format (24-hour)"),
      duration: z.number().describe("Duration in minutes"),
      description: z.string().optional().describe("Meeting description"),
      needsPrepTime: z.boolean().default(false).describe("Whether to create a prep block before the meeting"),
    }),
    metadata: {
      category: 'calendar',
      displayName: 'Schedule Meeting',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async (params) => {
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Create date object from concrete values - NO PARSING
      const dateParts = params.date.split('-');
      const timeParts = params.startTime.split(':');
      
      if (dateParts.length !== 3 || timeParts.length !== 2) {
        throw new Error('Invalid date or time format');
      }
      
      const year = parseInt(dateParts[0] || '0');
      const month = parseInt(dateParts[1] || '0');
      const day = parseInt(dateParts[2] || '0');
      const hours = parseInt(timeParts[0] || '0');
      const minutes = parseInt(timeParts[1] || '0');
      
      const meetingStart = new Date(year, month - 1, day, hours, minutes);
      const meetingEnd = addMinutes(meetingStart, params.duration);
      
      // Check for conflicts
      const endTimeStr = format(meetingEnd, 'HH:mm');
      
      const hasConflict = await scheduleService.checkForConflicts(
        params.startTime,
        endTimeStr,
        params.date
      );
      
      if (hasConflict) {
        return {
          success: false,
          error: 'The selected time has conflicts. Please choose a different time.',
          meeting: {
            id: '',
            title: params.title,
            startTime: meetingStart.toISOString(),
            endTime: meetingEnd.toISOString(),
            attendees: params.attendees,
            location: undefined,
            description: params.description,
          },
          prepBlockCreated: false,
        };
      }
      
      // Create the meeting
      const meeting = await calendarService.createEvent({
        summary: params.title,
        description: params.description,
        start: meetingStart,
        end: meetingEnd,
        attendees: params.attendees.map(email => ({ email })),
      });
      
      // Add prep time if needed
      let prepBlockId: string | null = null;
      if (params.needsPrepTime) {
        const prepDuration = Math.min(15, params.duration / 2);
        const prepStart = addMinutes(meetingStart, -prepDuration);
        
        try {
          const prepBlock = await scheduleService.createTimeBlock({
            type: 'blocked',
            title: `Prep: ${params.title}`,
            startTime: format(prepStart, 'HH:mm'),
            endTime: params.startTime,
            date: params.date,
            description: `Preparation time for ${params.title}`,
          });
          prepBlockId = prepBlock.id;
        } catch (error) {
          console.warn('Failed to create prep block:', error);
        }
      }
      
      console.log(`[Tool: scheduleMeeting] Created meeting ${meeting.id} for ${params.title}`);
      
      // Return pure data
      return {
        success: true,
        meeting: {
          id: meeting.id,
          title: meeting.summary || params.title,
          startTime: meetingStart.toISOString(),
          endTime: meetingEnd.toISOString(),
          attendees: params.attendees,
          location: meeting.location,
          description: meeting.description,
        },
        prepBlockCreated: !!prepBlockId,
      };
    },
  })
);

const parameters = z.object({
  title: z.string().describe("Meeting title"),
  attendees: z.array(z.string()).describe("Email addresses of attendees"),
  date: z.string().describe("Date in YYYY-MM-DD format"),
  startTime: z.string().describe("Start time in HH:MM format (24-hour)"),
  duration: z.number().describe("Duration in minutes"),
  description: z.string().optional().describe("Meeting description"),
  needsPrepTime: z.boolean().default(false).describe("Whether to create a prep block before the meeting"),
}); 