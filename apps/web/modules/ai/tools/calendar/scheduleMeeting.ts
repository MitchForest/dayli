import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ScheduleMeetingResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format, addMinutes } from 'date-fns';
import { parseFlexibleTime } from '../../utils/time-parser';

export const scheduleMeeting = registerTool(
  createTool<typeof parameters, ScheduleMeetingResponse>({
    name: 'calendar_scheduleMeeting',
    description: "Schedule a new meeting with smart time finding",
    parameters: z.object({
      title: z.string(),
      attendees: z.array(z.string()).describe("Email addresses"),
      duration: z.number().default(30).describe("Duration in minutes"),
      description: z.string().optional(),
      preferredTimes: z.array(z.string()).optional().describe("Preferred time slots"),
      needsPrepTime: z.boolean().default(false),
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
      
      // For now, use a simple implementation
      // In a real implementation, this would check attendee availability
      const now = new Date();
      const meetingStart = params.preferredTimes?.[0] 
        ? parseNaturalDateTime(params.preferredTimes[0])
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
        return {
          success: false,
          error: 'The selected time has conflicts. Please choose a different time.',
          meeting: null,
          conflicts: [], // In a real implementation, we'd return the conflicting events
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
            endTime: timeStr,
            date: dateStr,
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
          description: meeting.description,
          startTime: meetingStart.toISOString(),
          endTime: meetingEnd.toISOString(),
          attendees: params.attendees.map(email => ({ 
            email, 
            responseStatus: 'needsAction' as const,
          })),
          location: meeting.location,
          prepTimeAdded: !!prepBlockId,
        },
        conflicts: [],
      };
      
    },
  })
);

const parameters = z.object({
  title: z.string(),
  attendees: z.array(z.string()).describe("Email addresses"),
  duration: z.number().default(30).describe("Duration in minutes"),
  description: z.string().optional(),
  preferredTimes: z.array(z.string()).optional().describe("Preferred time slots"),
  needsPrepTime: z.boolean().default(false),
});

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