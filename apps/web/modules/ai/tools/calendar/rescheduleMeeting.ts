import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type CalendarEvent } from '../../schemas/calendar.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour, formatDate } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, parseISO } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

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
  description: "Reschedule an existing meeting to a new time",
  parameters: z.object({
    eventId: z.string().describe("Calendar event ID"),
    newTime: z.string().describe("New date/time for the meeting"),
    reason: z.string().optional().describe("Reason for rescheduling"),
    notifyAttendees: z.boolean().default(true),
  }),
  execute: async (params): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'rescheduleMeeting',
      operation: 'update' as const,
      resourceType: 'meeting' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      
      // Get current event
      const event = await calendarService.getEvent(params.eventId);
      if (!event) {
        return buildErrorResponse(
          toolOptions,
          new Error('Meeting not found'),
          {
            title: 'Meeting not found',
            description: `Could not find meeting with ID ${params.eventId}`,
          }
        );
      }
      
      // Extract current dates
      const currentStart = getEventDate(event.start);
      const currentEnd = getEventDate(event.end);
      
      // Parse new time
      const parsed = parseNaturalTime(params.newTime);
      const duration = currentEnd.getTime() - currentStart.getTime();
      const newEnd = new Date(parsed.getTime() + duration);
      
      // Check conflicts
      const conflicts = await calendarService.checkConflicts({
        start: parsed,
        end: newEnd,
        excludeEventId: params.eventId,
      });
      
      if (conflicts.length > 0) {
        return buildErrorResponse(
          toolOptions,
          new Error(`Cannot reschedule - conflicts with: ${conflicts.map(c => c.summary).join(', ')}`),
          {
            title: 'Time conflict',
            description: `Cannot reschedule - conflicts with: ${conflicts.map(c => c.summary).join(', ')}`,
          }
        );
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
      
      const calendarEvent: CalendarEvent = {
        id: updated.id,
        title: updated.summary || '',
        description: updated.description,
        startTime: parsed.toISOString(),
        endTime: newEnd.toISOString(),
        attendees: event.attendees?.map(a => ({
          email: a.email || '',
          responseStatus: a.responseStatus,
          isOrganizer: false,
          isOptional: false,
        })),
        location: updated.location,
        isAllDay: false,
        status: 'confirmed',
        visibility: 'public',
      };
      
      return buildToolResponse(
        toolOptions,
        {
          event: calendarEvent,
          oldTime: {
            start: formatTime12Hour(currentStart),
            end: formatTime12Hour(currentEnd),
            date: formatDate(currentStart),
          },
          newTime: {
            start: formatTime12Hour(parsed),
            end: formatTime12Hour(newEnd),
            date: formatDate(parsed),
          },
          attendeesNotified: params.notifyAttendees && (event.attendees?.length || 0) > 0,
        },
        {
          type: 'card',
          title: 'Meeting Rescheduled',
          description: `"${event.summary}" moved from ${formatTime12Hour(currentStart)} to ${formatTime12Hour(parsed)}`,
          priority: 'high',
          components: [
            {
              type: 'meetingCard',
              data: {
                id: updated.id,
                title: event.summary || '',
                startTime: formatTime12Hour(parsed),
                endTime: formatTime12Hour(newEnd),
                date: formatDate(parsed),
                attendees: event.attendees?.map(a => ({ 
                  email: a.email || '', 
                  name: a.displayName || a.email?.split('@')[0] || 'Unknown',
                })) || [],
                location: updated.location,
                hasConflicts: false,
              },
            },
          ],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: `Meeting rescheduled${params.notifyAttendees && event.attendees?.length ? ' and attendees notified' : ''}`,
            duration: 3000,
          },
          suggestions: [
            'View updated calendar',
            'Send additional notes to attendees',
            'Check for other conflicts',
          ],
          actions: [
            {
              id: 'view-calendar',
              label: 'View Calendar',
              icon: 'calendar',
              variant: 'primary',
              action: {
                type: 'message',
                message: 'Show my calendar',
              },
            },
            ...(event.attendees && event.attendees.length > 0 ? [{
              id: 'send-update',
              label: 'Send Update',
              icon: 'mail',
              variant: 'secondary' as const,
              action: {
                type: 'tool' as const,
                tool: 'draftEmailResponse',
                params: {
                  to: event.attendees.map(a => a.email).filter(Boolean),
                  subject: `Meeting Update: ${event.summary}`,
                  keyPoints: [
                    `Meeting rescheduled to ${formatDate(parsed)} at ${formatTime12Hour(parsed)}`,
                    params.reason || 'Schedule adjustment',
                  ],
                },
              },
            }] : []),
          ],
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to reschedule meeting',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 