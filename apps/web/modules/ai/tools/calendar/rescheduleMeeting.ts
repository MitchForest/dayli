import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type RescheduleMeetingResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';

// Helper to get Date from event start/end
function getEventDate(eventTime: { dateTime?: string; date?: string }): Date {
  if (eventTime.dateTime) {
    return new Date(eventTime.dateTime);
  } else if (eventTime.date) {
    return new Date(eventTime.date);
  }
  throw new Error('Event has no valid date');
}

export const rescheduleMeeting = registerTool(
  createTool<typeof parameters, RescheduleMeetingResponse>({
    name: 'calendar_rescheduleMeeting',
    description: "Reschedule an existing meeting - requires concrete date and time",
    parameters: z.object({
      eventId: z.string().describe("Calendar event ID"),
      newDate: z.string().describe("New date in YYYY-MM-DD format"),
      newStartTime: z.string().describe("New start time in HH:MM format (24-hour)"),
      newEndTime: z.string().describe("New end time in HH:MM format (24-hour)"),
      reason: z.string().optional().describe("Reason for rescheduling"),
      notifyAttendees: z.boolean().default(true),
    }),
    metadata: {
      category: 'calendar',
      displayName: 'Reschedule Meeting',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async (params) => {
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      
      // Validate time format
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(params.newStartTime) || !timeRegex.test(params.newEndTime)) {
        throw new Error('Invalid time format. Expected HH:MM');
      }
      
      // Get current event
      const event = await calendarService.getEvent(params.eventId);
      if (!event) {
        return {
          success: false,
          error: `Could not find meeting with ID ${params.eventId}`,
          meetingId: params.eventId,
          previousTime: {
            startTime: '',
            endTime: '',
          },
          newTime: {
            startTime: '',
            endTime: '',
          },
          notificationsSent: false,
        };
      }
      
      // Extract current dates
      const currentStart = getEventDate(event.start);
      const currentEnd = getEventDate(event.end);
      
      // Create new date/time from concrete values
      const newStart = new Date(`${params.newDate}T${params.newStartTime}:00`);
      const newEnd = new Date(`${params.newDate}T${params.newEndTime}:00`);
      
      // Check conflicts
      const conflicts = await calendarService.checkConflicts({
        start: newStart,
        end: newEnd,
        excludeEventId: params.eventId,
      });
      
      if (conflicts.length > 0) {
        return {
          success: false,
          error: `Cannot reschedule - conflicts with: ${conflicts.map(c => c.summary).join(', ')}`,
          meetingId: params.eventId,
          previousTime: {
            startTime: currentStart.toISOString(),
            endTime: currentEnd.toISOString(),
          },
          newTime: {
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          },
          notificationsSent: false,
        };
      }
      
      // Update the event
      const updated = await calendarService.updateEvent(params.eventId, {
        start: newStart,
        end: newEnd,
        description: event.description + 
          `\n\nRescheduled from ${format(currentStart, 'PPpp')}` +
          (params.reason ? ` - Reason: ${params.reason}` : ''),
      });
      
      // Notify attendees if requested
      if (params.notifyAttendees && event.attendees && event.attendees.length > 0) {
        await calendarService.sendUpdateNotification(params.eventId, {
          message: `Meeting rescheduled to ${format(newStart, 'PPpp')}` +
            (params.reason ? ` - ${params.reason}` : ''),
        });
      }
      
      console.log(`[Tool: rescheduleMeeting] Rescheduled meeting ${params.eventId} from ${format(currentStart, 'PPpp')} to ${format(newStart, 'PPpp')}`);
      
      // Return pure data
      return {
        success: true,
        meetingId: params.eventId,
        previousTime: {
          startTime: currentStart.toISOString(),
          endTime: currentEnd.toISOString(),
        },
        newTime: {
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        },
        notificationsSent: params.notifyAttendees && (event.attendees?.length || 0) > 0,
      };
    },
  })
);

const parameters = z.object({
  eventId: z.string().describe("Calendar event ID"),
  newDate: z.string().describe("New date in YYYY-MM-DD format"),
  newStartTime: z.string().describe("New start time in HH:MM format (24-hour)"),
  newEndTime: z.string().describe("New end time in HH:MM format (24-hour)"),
  reason: z.string().optional().describe("Reason for rescheduling"),
  notifyAttendees: z.boolean().default(true),
});