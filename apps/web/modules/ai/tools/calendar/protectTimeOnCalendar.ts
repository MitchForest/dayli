import { tool } from 'ai';
import { z } from 'zod';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { parseFlexibleTime } from '../../utils/time-parser';

export const protectTimeOnCalendar = tool({
  description: "Block time on Google Calendar to protect focus/break time",
  parameters: z.object({
    block: z.object({
      title: z.string(),
      startTime: z.string().describe("Time in flexible format (e.g., '9 AM', '14:30')"),
      endTime: z.string().describe("Time in flexible format (e.g., '10 AM', '15:30')"),
      type: z.enum(['work', 'break', 'email']).describe("Type of time block to protect"),
      date: z.string().optional().describe("Date in YYYY-MM-DD format, defaults to today"),
    }),
    markAsBusy: z.boolean().default(true),
    color: z.enum(['blue', 'green', 'red', 'purple']).optional(),
  }),
  execute: async ({ block, markAsBusy, color }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'protectTimeOnCalendar',
      operation: 'create' as const,
      resourceType: 'meeting' as const, // Using 'meeting' as calendar events are meetings
      startTime,
    };
    
    try {
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      
      // Parse times
      const parsedStartTime = parseFlexibleTime(block.startTime);
      const parsedEndTime = parseFlexibleTime(block.endTime);
      
      if (!parsedStartTime || !parsedEndTime) {
        return buildErrorResponse(
          toolOptions,
          new Error('Invalid time format'),
          {
            title: 'Invalid time format',
            description: 'Please provide valid times (e.g., "9 AM", "2:30 PM")',
          }
        );
      }
      
      // Get color ID mapping
      const colorMap: Record<string, string> = {
        blue: '1',
        green: '10',
        red: '11',
        purple: '9',
      };
      
      // For now, this is a placeholder that logs the action
      // Will be fully implemented when Google Calendar API is integrated
      console.log('[CALENDAR PROTECTION] Would create calendar event:', {
        summary: block.title,
        start: parsedStartTime.formatted,
        end: parsedEndTime.formatted,
        date: block.date,
        busy: markAsBusy,
        colorId: color ? colorMap[color] : undefined,
      });
      
      // TODO: In Sprint 03.05, this will create actual Google Calendar events
      // const event = await calendarService.createEvent({
      //   summary: block.title,
      //   start: { dateTime: `${block.date}T${parsedStartTime.formatted}:00` },
      //   end: { dateTime: `${block.date}T${parsedEndTime.formatted}:00` },
      //   transparency: markAsBusy ? 'opaque' : 'transparent',
      //   colorId: color ? colorMap[color] : undefined,
      //   reminders: { useDefault: false },
      // });
      
      const eventData = {
        protected: true,
        title: block.title,
        type: block.type,
        startTime: parsedStartTime.formatted,
        endTime: parsedEndTime.formatted,
        date: block.date || new Date().toISOString().split('T')[0],
        markAsBusy,
        color,
        message: `Protected ${block.type} time: ${block.title}`,
        // eventId: event.id, // Will be available after API integration
      };
      
      return buildToolResponse(
        toolOptions,
        eventData,
        {
          type: 'card',
          title: 'Calendar Time Protected',
          description: `Successfully protected ${block.type} time on your calendar`,
          priority: 'low',
          components: [
            {
              type: 'scheduleBlock',
              data: {
                id: `protected-${Date.now()}`,
                title: block.title,
                type: block.type,
                startTime: parsedStartTime.displayFormatted,
                endTime: parsedEndTime.displayFormatted,
              },
            },
          ],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: `Protected ${block.type} time on calendar`,
            duration: 3000,
          },
          suggestions: [
            'View my schedule',
            'Protect another time block',
            'Remove calendar protection',
          ],
          actions: [
            {
              id: 'view-schedule',
              label: 'View Schedule',
              icon: 'calendar',
              variant: 'secondary',
              action: {
                type: 'tool',
                tool: 'getSchedule',
                params: { date: block.date },
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
          title: 'Calendar protection failed',
          description: error instanceof Error ? error.message : 'Failed to protect time on calendar',
        }
      );
    }
  },
}); 