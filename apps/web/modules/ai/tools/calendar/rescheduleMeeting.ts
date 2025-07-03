import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type RescheduleMeetingResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { parseFlexibleTime } from '../../utils/time-parser';
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

// Helper to parse natural language date/time
function parseNaturalDateTime(input: string): Date {
  const now = new Date();
  const lower = input.toLowerCase();
  
  // Handle relative days
  if (lower.includes('tomorrow')) {
    now.setDate(now.getDate() + 1);
  } else if (lower.includes('next week')) {
    now.setDate(now.getDate() + 7);
  }
  
  // Extract time using flexible parser
  const timeResult = parseFlexibleTime(input);
  if (timeResult) {
    now.setHours(timeResult.hour, timeResult.minute, 0, 0);
  }
  
  return now;
}

export const rescheduleMeeting = registerTool(
  createTool<typeof parameters, RescheduleMeetingResponse>({
    name: 'calendar_rescheduleMeeting',
    description: "Reschedule an existing meeting to a new time",
    parameters: z.object({
      eventId: z.string().describe("Calendar event ID"),
      newTime: z.string().describe("New date/time for the meeting"),
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
      
      // Get current event
      const event = await calendarService.getEvent(params.eventId);
      if (!event) {
        return {
          success: false,
          error: `Could not find meeting with ID ${params.eventId}`,
          meetingId: params.eventId,
          previousTime: {
            startTime: new Date(),
            endTime: new Date(),
          },
          newTime: {
            startTime: new Date(),
            endTime: new Date(),
          },
          notificationsSent: false,
        };
      }
      
      // Extract current dates
      const currentStart = getEventDate(event.start);
      const currentEnd = getEventDate(event.end);
      
      // Parse new time
      const parsed = parseNaturalDateTime(params.newTime);
      const duration = currentEnd.getTime() - currentStart.getTime();
      const newEnd = new Date(parsed.getTime() + duration);
      
      // Check conflicts
      const conflicts = await calendarService.checkConflicts({
        start: parsed,
        end: newEnd,
        excludeEventId: params.eventId,
      });
      
      if (conflicts.length > 0) {
        return {
          success: false,
          error: `Cannot reschedule - conflicts with: ${conflicts.map(c => c.summary).join(', ')}`,
          meetingId: params.eventId,
          previousTime: {
            startTime: currentStart,
            endTime: currentEnd,
          },
          newTime: {
            startTime: parsed,
            endTime: newEnd,
          },
          notificationsSent: false,
        };
      }
      
      // Update the event
      const updated = await calendarService.updateEvent(params.eventId, {
        start: parsed,
        end: newEnd,
        description: event.description + 
          `\n\nRescheduled from ${format(currentStart, 'PPpp')}` +
          (params.reason ? ` - Reason: ${params.reason}` : ''),
      });
      
      // Notify attendees if requested
      if (params.notifyAttendees && event.attendees && event.attendees.length > 0) {
        await calendarService.sendUpdateNotification(params.eventId, {
          message: `Meeting rescheduled to ${format(parsed, 'PPpp')}` +
            (params.reason ? ` - ${params.reason}` : ''),
        });
      }
      
      console.log(`[Tool: rescheduleMeeting] Rescheduled meeting ${params.eventId} from ${format(currentStart, 'PPpp')} to ${format(parsed, 'PPpp')}`);
      
      // Return pure data
      return {
        success: true,
        meetingId: params.eventId,
        previousTime: {
          startTime: currentStart,
          endTime: currentEnd,
        },
        newTime: {
          startTime: parsed,
          endTime: newEnd,
        },
        notificationsSent: params.notifyAttendees && (event.attendees?.length || 0) > 0,
      };
      
    },
  })
);

const parameters = z.object({
  eventId: z.string().describe("Calendar event ID"),
  newTime: z.string().describe("New date/time for the meeting"),
  reason: z.string().optional().describe("Reason for rescheduling"),
  notifyAttendees: z.boolean().default(true),
}); 