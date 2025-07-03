import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, isWithinInterval, addMinutes } from 'date-fns';

interface Conflict {
  type: 'time_overlap' | 'travel_time' | 'resource' | 'preference';
  severity: 'high' | 'medium' | 'low';
  items: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    type: 'meeting' | 'block' | 'event';
  }>;
  description: string;
  suggestions: string[];
}

export const detectConflicts = tool({
  description: 'Detect scheduling conflicts including overlaps, travel time, and resource conflicts',
  parameters: z.object({
    date: z.string().describe('Date to check for conflicts (YYYY-MM-DD)'),
    checkTravelTime: z.boolean().optional().default(true).describe('Check for travel time conflicts'),
    bufferMinutes: z.number().optional().default(15).describe('Buffer time between events'),
  }),
  execute: async ({ date, checkTravelTime, bufferMinutes }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'detectConflicts',
      operation: 'read' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get schedule blocks for the date
      const blocks = await scheduleService.getScheduleForDate(date);
      
      // Get calendar events for the date
      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59`);
      
      const calendarEvents = await calendarService.listEvents({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
      });
      
      // Combine all items for conflict detection
      const allItems = [
        ...blocks.map(block => ({
          id: block.id,
          title: block.title,
          startTime: block.startTime.toISOString(),
          endTime: block.endTime.toISOString(),
          type: 'block' as const,
          location: null,
        })),
        ...(calendarEvents.items || []).map((event: any) => ({
          id: event.id,
          title: event.summary || 'Untitled Event',
          startTime: event.start?.dateTime || event.start?.date || '',
          endTime: event.end?.dateTime || event.end?.date || '',
          type: 'event' as const,
          location: event.location || null,
        })),
      ];
      
      // Detect conflicts
      const conflicts: Conflict[] = [];
      
      // 1. Time overlap conflicts
      for (let i = 0; i < allItems.length; i++) {
        for (let j = i + 1; j < allItems.length; j++) {
          const item1 = allItems[i];
          const item2 = allItems[j];
          
          if (!item1 || !item2) continue;
          if (!item1.startTime || !item1.endTime || !item2.startTime || !item2.endTime) continue;
          
          const start1 = parseISO(item1.startTime);
          const end1 = parseISO(item1.endTime);
          const start2 = parseISO(item2.startTime);
          const end2 = parseISO(item2.endTime);
          
          // Check for overlap
          const overlaps = (
            isWithinInterval(start1, { start: start2, end: end2 }) ||
            isWithinInterval(end1, { start: start2, end: end2 }) ||
            isWithinInterval(start2, { start: start1, end: end1 }) ||
            isWithinInterval(end2, { start: start1, end: end1 })
          );
          
          if (overlaps) {
            conflicts.push({
              type: 'time_overlap',
              severity: 'high',
              items: [item1, item2],
              description: `"${item1.title}" overlaps with "${item2.title}"`,
              suggestions: [
                `Reschedule ${item1.title} to an earlier time`,
                `Shorten ${item1.title} to end before ${item2.startTime}`,
                `Move ${item2.title} to after ${item1.endTime}`,
              ],
            });
          }
        }
      }
      
      // 2. Buffer time conflicts
      if (bufferMinutes > 0) {
        for (let i = 0; i < allItems.length; i++) {
          for (let j = i + 1; j < allItems.length; j++) {
            const item1 = allItems[i];
            const item2 = allItems[j];
            
            if (!item1 || !item2) continue;
            if (!item1.startTime || !item1.endTime || !item2.startTime || !item2.endTime) continue;
            
            const end1 = parseISO(item1.endTime);
            const start2 = parseISO(item2.startTime);
            const end2 = parseISO(item2.endTime);
            const start1 = parseISO(item1.startTime);
            
            // Check if items are back-to-back without buffer
            const minutesBetween1to2 = (start2.getTime() - end1.getTime()) / (1000 * 60);
            const minutesBetween2to1 = (start1.getTime() - end2.getTime()) / (1000 * 60);
            
            if (minutesBetween1to2 >= 0 && minutesBetween1to2 < bufferMinutes) {
              conflicts.push({
                type: 'time_overlap',
                severity: 'medium',
                items: [item1, item2],
                description: `Only ${Math.round(minutesBetween1to2)} minutes between "${item1.title}" and "${item2.title}"`,
                suggestions: [
                  `Add ${bufferMinutes} minute buffer between events`,
                  `End ${item1.title} ${bufferMinutes - minutesBetween1to2} minutes earlier`,
                ],
              });
            } else if (minutesBetween2to1 >= 0 && minutesBetween2to1 < bufferMinutes) {
              conflicts.push({
                type: 'time_overlap',
                severity: 'medium',
                items: [item2, item1],
                description: `Only ${Math.round(minutesBetween2to1)} minutes between "${item2.title}" and "${item1.title}"`,
                suggestions: [
                  `Add ${bufferMinutes} minute buffer between events`,
                  `End ${item2.title} ${bufferMinutes - minutesBetween2to1} minutes earlier`,
                ],
              });
            }
          }
        }
      }
      
      // 3. Travel time conflicts (if locations are different)
      if (checkTravelTime) {
        const itemsWithLocation = allItems.filter(item => item.location);
        
        for (let i = 0; i < itemsWithLocation.length - 1; i++) {
          const item1 = itemsWithLocation[i];
          const item2 = itemsWithLocation[i + 1];
          
          if (!item1 || !item2) continue;
          if (item1.location !== item2.location) {
            const end1 = parseISO(item1.endTime);
            const start2 = parseISO(item2.startTime);
            const timeBetween = (start2.getTime() - end1.getTime()) / (1000 * 60);
            
            // Assume 30 minutes travel time for different locations
            const requiredTravelTime = 30;
            
            if (timeBetween < requiredTravelTime && timeBetween >= 0) {
              conflicts.push({
                type: 'travel_time',
                severity: 'high',
                items: [item1, item2],
                description: `Not enough travel time between locations`,
                suggestions: [
                  `Allow at least ${requiredTravelTime} minutes for travel`,
                  `Change ${item2.title} to virtual/remote`,
                  `Move ${item2.title} to the same location`,
                ],
              });
            }
          }
        }
      }
      
      // 4. Preference conflicts (check user preferences)
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('lunch_start_time, lunch_duration_minutes, protect_deep_work')
        .eq('user_id', user.id)
        .single();
      
      if (preferences?.lunch_start_time) {
        const lunchStart = `${date}T${preferences.lunch_start_time}`;
        const lunchEnd = addMinutes(parseISO(lunchStart), preferences.lunch_duration_minutes || 60);
        
        for (const item of allItems) {
          const itemStart = parseISO(item.startTime);
          const itemEnd = parseISO(item.endTime);
          
          if (
            isWithinInterval(itemStart, { start: parseISO(lunchStart), end: lunchEnd }) ||
            isWithinInterval(itemEnd, { start: parseISO(lunchStart), end: lunchEnd })
          ) {
            conflicts.push({
              type: 'preference',
              severity: 'medium',
              items: [item],
              description: `"${item.title}" conflicts with lunch time`,
              suggestions: [
                `Move ${item.title} to after lunch`,
                `Schedule ${item.title} before lunch`,
                `Shorten lunch break for this day`,
              ],
            });
          }
        }
      }
      
      // Remove duplicate conflicts
      const uniqueConflicts = conflicts.filter((conflict, index, self) =>
        index === self.findIndex(c =>
          c.type === conflict.type &&
          c.items.every(item => conflict.items.some(i => i.id === item.id))
        )
      );
      
      return buildToolResponse(
        toolOptions,
        {
          date,
          conflicts: uniqueConflicts,
          summary: {
            totalConflicts: uniqueConflicts.length,
            highSeverity: uniqueConflicts.filter(c => c.severity === 'high').length,
            mediumSeverity: uniqueConflicts.filter(c => c.severity === 'medium').length,
            lowSeverity: uniqueConflicts.filter(c => c.severity === 'low').length,
          },
        },
        {
          type: 'list',
          title: 'Schedule Conflicts Detected',
          description: uniqueConflicts.length > 0 
            ? `Found ${uniqueConflicts.length} conflicts on ${date}`
            : `No conflicts found on ${date}`,
          priority: uniqueConflicts.some(c => c.severity === 'high') ? 'high' : 'medium',
          components: uniqueConflicts.slice(0, 3).map(conflict => ({
            type: 'confirmationDialog',
            data: {
              title: conflict.description,
              message: conflict.suggestions[0] || 'Consider rescheduling',
              confirmText: 'Resolve',
              cancelText: 'Later',
              variant: conflict.severity === 'high' ? 'danger' : 'warning',
            },
          })),
        },
        {
          suggestions: uniqueConflicts.length > 0 ? [
            'Resolve high severity conflicts first',
            'Use AI to suggest optimal schedule',
            'Enable calendar protection',
            'Review scheduling preferences',
          ] : [
            'Schedule looks good!',
            'Add more events to your calendar',
          ],
          notification: {
            show: true,
            type: uniqueConflicts.length > 0 ? 'warning' : 'success',
            message: uniqueConflicts.length > 0 
              ? `${uniqueConflicts.length} conflicts need attention`
              : 'No scheduling conflicts',
            duration: 4000,
          },
          actions: uniqueConflicts.length > 0 ? [{
            id: 'resolve-conflicts',
            label: 'Resolve Conflicts',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Help me resolve the ${uniqueConflicts.length} scheduling conflicts`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[DETECT CONFLICTS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Conflict Detection Failed',
          description: 'Could not analyze schedule for conflicts.',
        }
      );
    }
  },
}); 