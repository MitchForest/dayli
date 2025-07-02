import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, parseISO } from 'date-fns';

// Helper to get Date from event start/end
function getEventDate(eventTime: { dateTime?: string; date?: string }): Date {
  if (eventTime.dateTime) {
    return new Date(eventTime.dateTime);
  } else if (eventTime.date) {
    return new Date(eventTime.date);
  }
  throw new Error('Event has no valid date');
}

// Helper to parse natural language time
function parseNaturalTime(timeStr: string): Date {
  // Simple implementation - in production would use a proper NLP library
  const now = new Date();
  const lower = timeStr.toLowerCase();
  
  if (lower.includes('tomorrow')) {
    now.setDate(now.getDate() + 1);
  }
  
  // Extract time like "3pm", "15:00", etc
  const timeMatch = timeStr.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1] || '0', 10);
    const minutes = parseInt(timeMatch[2] || '0', 10);
    const meridiem = timeMatch[3]?.toLowerCase();
    
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    
    now.setHours(hours, minutes, 0, 0);
  }
  
  return now;
}

export const rescheduleMeeting = tool({
  description: "Reschedule an existing meeting",
  parameters: z.object({
    eventId: z.string().describe("Calendar event ID"),
    newTime: z.string().describe("New time in natural language"),
    reason: z.string().optional(),
    notifyAttendees: z.boolean().default(true),
  }),
  execute: async ({ eventId, newTime, reason, notifyAttendees }) => {
    try {
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      
      // Get current event
      const event = await calendarService.getEvent(eventId);
      if (!event) {
        return toolError(
          'MEETING_NOT_FOUND',
          'Meeting not found'
        );
      }
      
      // Extract current dates
      const currentStart = getEventDate(event.start);
      const currentEnd = getEventDate(event.end);
      
      // Parse new time
      const parsed = parseNaturalTime(newTime);
      const duration = currentEnd.getTime() - currentStart.getTime();
      const newEnd = new Date(parsed.getTime() + duration);
      
      // Check conflicts
      const conflicts = await calendarService.checkConflicts({
        start: parsed,
        end: newEnd,
        excludeEventId: eventId,
      });
      
      if (conflicts.length > 0) {
        return toolError(
          'TIME_CONFLICT',
          `Cannot reschedule - conflicts with: ${conflicts.map(c => c.summary).join(', ')}`,
          {
            conflicts: conflicts.map(c => ({
              title: c.summary,
              time: `${format(getEventDate(c.start), 'h:mm a')} - ${format(getEventDate(c.end), 'h:mm a')}`
            }))
          }
        );
      }
      
      // Update the event
      const updated = await calendarService.updateEvent(eventId, {
        start: parsed,
        end: newEnd,
        description: event.description + 
          `\n\nRescheduled from ${format(currentStart, 'PPpp')}` +
          (reason ? ` - Reason: ${reason}` : ''),
      });
      
      // Notify attendees if requested
      if (notifyAttendees && event.attendees && event.attendees.length > 0) {
        await calendarService.sendUpdateNotification(eventId, {
          message: `Meeting rescheduled to ${format(parsed, 'PPpp')}` +
            (reason ? ` - ${reason}` : ''),
        });
      }
      
      return toolSuccess({
        meeting: updated,
        oldTime: format(currentStart, 'PPpp'),
        newTime: format(parsed, 'PPpp'),
        attendeesNotified: notifyAttendees && (event.attendees?.length || 0) > 0
      }, {
        type: 'text',
        content: `Rescheduled "${event.summary}" from ${format(currentStart, 'h:mm a')} to ${format(parsed, 'h:mm a')}`
      }, {
        affectedItems: [eventId],
        suggestions: [
          'View updated calendar',
          'Send additional notes to attendees',
          'Check for other conflicts'
        ]
      });
      
    } catch (error) {
      return toolError(
        'RESCHEDULE_FAILED',
        `Failed to reschedule meeting: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 