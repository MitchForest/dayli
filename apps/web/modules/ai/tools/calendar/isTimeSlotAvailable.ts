import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, isWithinInterval } from 'date-fns';

export const isTimeSlotAvailable = tool({
  description: 'Check if a specific time slot is available across calendar and schedule',
  parameters: z.object({
    date: z.string().describe('Date to check (YYYY-MM-DD)'),
    startTime: z.string().describe('Start time in HH:MM format'),
    endTime: z.string().describe('End time in HH:MM format'),
    checkCalendar: z.boolean().optional().default(true).describe('Check Google Calendar'),
    checkSchedule: z.boolean().optional().default(true).describe('Check schedule blocks'),
    bufferMinutes: z.number().optional().default(0).describe('Required buffer before/after'),
  }),
  execute: async ({ date, startTime, endTime, checkCalendar, checkSchedule, bufferMinutes }): Promise<UniversalToolResponse> => {
    const startTimestamp = Date.now();
    const toolOptions = {
      toolName: 'isTimeSlotAvailable',
      operation: 'read' as const,
      resourceType: 'schedule' as const,
      startTime: startTimestamp,
    };
    
    try {
      await ensureServicesConfigured();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Parse the requested time slot
      const requestedStart = parseISO(`${date}T${startTime}`);
      const requestedEnd = parseISO(`${date}T${endTime}`);
      
      // Add buffer if specified
      const checkStart = new Date(requestedStart.getTime() - bufferMinutes * 60000);
      const checkEnd = new Date(requestedEnd.getTime() + bufferMinutes * 60000);
      
      let conflicts: Array<{
        source: 'calendar' | 'schedule';
        title: string;
        startTime: string;
        endTime: string;
        type: string;
      }> = [];
      
      // Check schedule blocks
      if (checkSchedule) {
        const hasConflict = await scheduleService.checkForConflicts(
          checkStart.toTimeString().slice(0, 5),
          checkEnd.toTimeString().slice(0, 5),
          date
        );
        
        if (hasConflict) {
          // Get the actual conflicting blocks
          const blocks = await scheduleService.getScheduleForDate(date);
          
          for (const block of blocks) {
            const blockStart = block.startTime;
            const blockEnd = block.endTime;
            
            // Check for overlap
            if (
              isWithinInterval(blockStart, { start: checkStart, end: checkEnd }) ||
              isWithinInterval(blockEnd, { start: checkStart, end: checkEnd }) ||
              isWithinInterval(checkStart, { start: blockStart, end: blockEnd }) ||
              isWithinInterval(checkEnd, { start: blockStart, end: blockEnd })
            ) {
              conflicts.push({
                source: 'schedule',
                title: block.title,
                startTime: block.startTime.toISOString(),
                endTime: block.endTime.toISOString(),
                type: block.type,
              });
            }
          }
        }
      }
      
      // Check calendar events
      if (checkCalendar) {
        const calendarEvents = await calendarService.listEvents({
          calendarId: 'primary',
          timeMin: checkStart.toISOString(),
          timeMax: checkEnd.toISOString(),
        });
        
        for (const event of calendarEvents.items || []) {
          if (event.start?.dateTime && event.end?.dateTime) {
            const eventStart = parseISO(event.start.dateTime);
            const eventEnd = parseISO(event.end.dateTime);
            
            // Check for overlap
            if (
              isWithinInterval(eventStart, { start: checkStart, end: checkEnd }) ||
              isWithinInterval(eventEnd, { start: checkStart, end: checkEnd }) ||
              isWithinInterval(checkStart, { start: eventStart, end: eventEnd }) ||
              isWithinInterval(checkEnd, { start: eventStart, end: eventEnd })
            ) {
              conflicts.push({
                source: 'calendar',
                title: event.summary || 'Untitled Event',
                startTime: event.start.dateTime,
                endTime: event.end.dateTime,
                type: 'event',
              });
            }
          }
        }
      }
      
      // Check user preferences for protected times
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('lunch_start_time, lunch_duration_minutes, work_start_time, work_end_time')
        .eq('user_id', user.id)
        .single();
      
      // Check if it's during lunch time
      if (preferences?.lunch_start_time) {
        const lunchStart = parseISO(`${date}T${preferences.lunch_start_time}`);
        const lunchEnd = new Date(lunchStart.getTime() + (preferences.lunch_duration_minutes || 60) * 60000);
        
        if (
          isWithinInterval(requestedStart, { start: lunchStart, end: lunchEnd }) ||
          isWithinInterval(requestedEnd, { start: lunchStart, end: lunchEnd })
        ) {
          conflicts.push({
            source: 'schedule',
            title: 'Lunch Break',
            startTime: lunchStart.toISOString(),
            endTime: lunchEnd.toISOString(),
            type: 'break',
          });
        }
      }
      
      // Check if it's outside work hours
      let outsideWorkHours = false;
      if (preferences?.work_start_time && preferences?.work_end_time) {
        const workStart = parseISO(`${date}T${preferences.work_start_time}`);
        const workEnd = parseISO(`${date}T${preferences.work_end_time}`);
        
        if (requestedStart < workStart || requestedEnd > workEnd) {
          outsideWorkHours = true;
        }
      }
      
      const isAvailable = conflicts.length === 0;
      
      return buildToolResponse(
        toolOptions,
        {
          date,
          startTime,
          endTime,
          isAvailable,
          conflicts,
          outsideWorkHours,
          summary: {
            available: isAvailable,
            conflictCount: conflicts.length,
            calendarConflicts: conflicts.filter(c => c.source === 'calendar').length,
            scheduleConflicts: conflicts.filter(c => c.source === 'schedule').length,
          },
        },
        {
          type: 'card',
          title: isAvailable ? 'Time Slot Available' : 'Time Slot Unavailable',
          description: isAvailable 
            ? `${startTime} - ${endTime} on ${date} is available`
            : `${conflicts.length} conflicts found for this time slot`,
          priority: isAvailable ? 'low' : 'high',
          components: conflicts.slice(0, 3).map(conflict => ({
            type: 'scheduleBlock',
            data: {
              id: `conflict-${conflict.startTime}`,
              type: conflict.type as any,
              title: conflict.title,
              startTime: new Date(conflict.startTime).toTimeString().slice(0, 5),
              endTime: new Date(conflict.endTime).toTimeString().slice(0, 5),
            },
          })),
        },
        {
          suggestions: isAvailable ? [
            'Schedule a meeting for this time',
            'Create a time block here',
            'Check another time slot',
          ] : [
            'Find next available slot',
            'Resolve conflicts first',
            'Try a different time',
            'Check calendar for gaps',
          ],
          notification: {
            show: true,
            type: isAvailable ? 'success' : 'warning',
            message: isAvailable 
              ? 'Time slot is available!'
              : `${conflicts.length} conflicts found`,
            duration: 3000,
          },
          actions: isAvailable ? [{
            id: 'schedule-here',
            label: 'Schedule Here',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Schedule a meeting at ${startTime} on ${date}`,
            },
          }] : [{
            id: 'find-alternative',
            label: 'Find Alternative',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Find an available time slot near ${startTime} on ${date}`,
            },
          }],
        }
      );
      
    } catch (error) {
      console.error('[CHECK AVAILABILITY] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Availability Check Failed',
          description: 'Could not check time slot availability.',
        }
      );
    }
  },
}); 