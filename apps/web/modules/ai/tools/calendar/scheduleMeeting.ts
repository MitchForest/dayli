import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type CalendarEvent } from '../../schemas/calendar.schema';
import { buildToolResponse, buildErrorResponse, formatTime12Hour, formatDate } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, addMinutes } from 'date-fns';
import { ensureServicesConfigured } from '../utils/auth';

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
  execute: async (params): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'scheduleMeeting',
      operation: 'create' as const,
      resourceType: 'meeting' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // For now, use a simple implementation
      // In a real implementation, this would check attendee availability
      const now = new Date();
      const meetingStart = params.preferredTimes?.[0] 
        ? new Date(params.preferredTimes[0])
        : addMinutes(now, 60); // Default to 1 hour from now
      
      const meetingEnd = addMinutes(meetingStart, params.duration);
      
      // Check for conflicts in local schedule
      const dateStr = format(meetingStart, 'yyyy-MM-dd');
      const timeStr = format(meetingStart, 'HH:mm');
      const endTimeStr = format(meetingEnd, 'HH:mm');
      
      const hasConflict = await scheduleService.checkForConflicts(
        timeStr,
        endTimeStr,
        dateStr
      );
      
      if (hasConflict) {
        return buildErrorResponse(
          toolOptions,
          new Error('The selected time has conflicts'),
          {
            title: 'Time conflict detected',
            description: 'The selected time has conflicts. Please choose a different time.',
          }
        );
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
            endTime: timeStr,
            date: dateStr,
            description: `Preparation time for ${params.title}`,
          });
          prepBlockId = prepBlock.id;
        } catch (error) {
          console.warn('Failed to create prep block:', error);
        }
      }
      
      const calendarEvent: CalendarEvent = {
        id: meeting.id,
        title: meeting.summary || params.title,
        description: meeting.description,
        startTime: meetingStart.toISOString(),
        endTime: meetingEnd.toISOString(),
        attendees: params.attendees.map(email => ({ 
          email, 
          responseStatus: 'needsAction',
          isOrganizer: false,
          isOptional: false,
        })),
        location: meeting.location,
        isAllDay: false,
        status: 'confirmed',
        visibility: 'public',
      };
      
      return buildToolResponse(
        toolOptions,
        {
          event: calendarEvent,
          prepTimeAdded: !!prepBlockId,
          prepBlockId,
        },
        {
          type: 'card',
          title: 'Meeting Scheduled',
          description: `"${params.title}" scheduled for ${formatDate(meetingStart)} at ${formatTime12Hour(meetingStart)}`,
          priority: 'high',
          components: [
            {
              type: 'meetingCard',
              data: {
                id: meeting.id,
                title: params.title,
                startTime: formatTime12Hour(meetingStart),
                endTime: formatTime12Hour(meetingEnd),
                date: formatDate(meetingStart),
                attendees: params.attendees.map(email => ({ 
                  email, 
                  name: email.split('@')[0] || 'Attendee' 
                })),
                location: meeting.location,
                hasConflicts: false,
              },
            },
          ],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: `Meeting scheduled${params.needsPrepTime ? ' with prep time' : ''}`,
            duration: 3000,
          },
          suggestions: [
            'View calendar',
            'Add another meeting',
            'Send meeting agenda',
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
            {
              id: 'send-agenda',
              label: 'Send Agenda',
              icon: 'mail',
              variant: 'secondary',
              action: {
                type: 'tool',
                tool: 'draftEmailResponse',
                params: {
                  to: params.attendees,
                  subject: `Agenda for: ${params.title}`,
                  keyPoints: [`Meeting scheduled for ${formatDate(meetingStart)} at ${formatTime12Hour(meetingStart)}`],
                },
              },
            },
          ],
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to schedule meeting',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 