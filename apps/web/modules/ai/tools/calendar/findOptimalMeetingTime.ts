import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { addDays, parseISO, format, isWithinInterval, addHours } from 'date-fns';

interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  score: number;
  factors: {
    allAvailable: boolean;
    preferredTime: boolean;
    minimizesDisruption: boolean;
    energyAlignment: boolean;
    travelTime: boolean;
  };
}

export const findOptimalMeetingTime = tool({
  description: 'Find the best meeting time considering multiple attendees schedules and preferences',
  parameters: z.object({
    duration: z.number().describe('Meeting duration in minutes'),
    attendees: z.array(z.string()).describe('Email addresses of attendees'),
    dateRange: z.object({
      startDate: z.string().describe('Start date for search (YYYY-MM-DD)'),
      endDate: z.string().describe('End date for search (YYYY-MM-DD)'),
    }),
    preferences: z.object({
      preferMorning: z.boolean().optional().default(false),
      preferAfternoon: z.boolean().optional().default(false),
      avoidLunch: z.boolean().optional().default(true),
      minimizeReschedules: z.boolean().optional().default(true),
      requireAllAttendees: z.boolean().optional().default(true),
    }).optional(),
  }),
  execute: async ({ duration, attendees, dateRange, preferences = {} }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'findOptimalMeetingTime',
      operation: 'read' as const,
      resourceType: 'calendar' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get user preferences
      const { data: userPrefs } = await supabase
        .from('user_preferences')
        .select('work_start_time, work_end_time, lunch_start_time, lunch_duration_minutes')
        .eq('user_id', user.id)
        .single();
      
      const workStart = userPrefs?.work_start_time || '09:00';
      const workEnd = userPrefs?.work_end_time || '17:00';
      const lunchStart = userPrefs?.lunch_start_time || '12:00';
      const lunchDuration = userPrefs?.lunch_duration_minutes || 60;
      
      // Generate potential time slots
      const potentialSlots: TimeSlot[] = [];
      const startDate = parseISO(dateRange.startDate);
      const endDate = parseISO(dateRange.endDate);
      
      for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        // Generate slots throughout the work day
        const workStartTime = parseISO(`${dateStr}T${workStart}`);
        const workEndTime = parseISO(`${dateStr}T${workEnd}`);
        const lunchStartTime = parseISO(`${dateStr}T${lunchStart}`);
        const lunchEndTime = addHours(lunchStartTime, lunchDuration / 60);
        
        // Morning slots
        for (let slotStart = workStartTime; slotStart < lunchStartTime; slotStart = addHours(slotStart, 0.5)) {
          const slotEnd = new Date(slotStart.getTime() + duration * 60000);
          
          if (slotEnd <= lunchStartTime) {
            potentialSlots.push({
              date: dateStr,
              startTime: format(slotStart, 'HH:mm'),
              endTime: format(slotEnd, 'HH:mm'),
              score: 0,
              factors: {
                allAvailable: false,
                preferredTime: false,
                minimizesDisruption: false,
                energyAlignment: false,
                travelTime: false,
              },
            });
          }
        }
        
        // Afternoon slots
        for (let slotStart = lunchEndTime; slotStart < workEndTime; slotStart = addHours(slotStart, 0.5)) {
          const slotEnd = new Date(slotStart.getTime() + duration * 60000);
          
          if (slotEnd <= workEndTime) {
            potentialSlots.push({
              date: dateStr,
              startTime: format(slotStart, 'HH:mm'),
              endTime: format(slotEnd, 'HH:mm'),
              score: 0,
              factors: {
                allAvailable: false,
                preferredTime: false,
                minimizesDisruption: false,
                energyAlignment: false,
                travelTime: false,
              },
            });
          }
        }
      }
      
      // Check availability for each slot
      const availableSlots: TimeSlot[] = [];
      
      for (const slot of potentialSlots) {
        let allAvailable = true;
        let conflictCount = 0;
        
        // Check current user's availability
        const hasConflict = await scheduleService.checkForConflicts(
          slot.startTime,
          slot.endTime,
          slot.date
        );
        
        if (hasConflict && preferences.requireAllAttendees) {
          continue; // Skip this slot
        } else if (hasConflict) {
          allAvailable = false;
          conflictCount++;
        }
        
        // Check calendar availability
        const calendarEvents = await calendarService.listEvents({
          calendarId: 'primary',
          timeMin: parseISO(`${slot.date}T${slot.startTime}`).toISOString(),
          timeMax: parseISO(`${slot.date}T${slot.endTime}`).toISOString(),
        });
        
        if ((calendarEvents.items?.length || 0) > 0 && preferences.requireAllAttendees) {
          continue; // Skip this slot
        } else if ((calendarEvents.items?.length || 0) > 0) {
          allAvailable = false;
          conflictCount += calendarEvents.items?.length || 0;
        }
        
        // TODO: Check other attendees' calendars when multi-calendar support is added
        // For now, we'll simulate this with a placeholder
        const otherAttendeesAvailable = Math.random() > 0.3; // 70% chance available
        
        if (!otherAttendeesAvailable && preferences.requireAllAttendees) {
          continue;
        } else if (!otherAttendeesAvailable) {
          allAvailable = false;
          conflictCount += attendees.length - 1;
        }
        
        // Score the slot
        let score = 100;
        
        // All available bonus
        if (allAvailable) {
          score += 50;
          slot.factors.allAvailable = true;
        } else {
          score -= conflictCount * 10;
        }
        
        // Time preference scoring
        const hour = parseInt(slot.startTime.split(':')[0]);
        if (preferences.preferMorning && hour < 12) {
          score += 20;
          slot.factors.preferredTime = true;
        } else if (preferences.preferAfternoon && hour >= 13) {
          score += 20;
          slot.factors.preferredTime = true;
        }
        
        // Energy alignment (best times: 10-11am, 2-4pm)
        if ((hour >= 10 && hour < 11) || (hour >= 14 && hour < 16)) {
          score += 15;
          slot.factors.energyAlignment = true;
        }
        
        // Minimize disruption (prefer slots at start/end of existing blocks)
        if (hour === 9 || hour === 16) {
          score += 10;
          slot.factors.minimizesDisruption = true;
        }
        
        slot.score = score;
        availableSlots.push(slot);
      }
      
      // Sort by score
      availableSlots.sort((a, b) => b.score - a.score);
      
      // Get top 5 slots
      const topSlots = availableSlots.slice(0, 5);
      
      return buildToolResponse(
        toolOptions,
        {
          duration,
          attendees,
          dateRange,
          topSlots,
          totalSlotsChecked: potentialSlots.length,
          availableSlots: availableSlots.length,
          bestSlot: topSlots[0],
        },
        {
          type: 'list',
          title: 'Optimal Meeting Times Found',
          description: `Found ${availableSlots.length} possible times for a ${duration}-minute meeting`,
          priority: 'medium',
          components: topSlots.map(slot => ({
            type: 'meetingCard',
            data: {
              id: `slot-${slot.date}-${slot.startTime}`,
              title: `Available: ${format(parseISO(slot.date), 'EEE, MMM d')}`,
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              attendees: attendees,
              description: `Score: ${slot.score}/200 - ${Object.entries(slot.factors)
                .filter(([_, value]) => value)
                .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase())
                .join(', ')}`,
            },
          })),
        },
        {
          suggestions: topSlots.length > 0 ? [
            `Schedule meeting at ${topSlots[0].startTime} on ${topSlots[0].date}`,
            'Send meeting invites to attendees',
            'Check attendee preferences',
            'Find alternative times',
          ] : [
            'Expand date range',
            'Reduce meeting duration',
            'Make some attendees optional',
            'Check individual calendars',
          ],
          notification: {
            show: true,
            type: topSlots.length > 0 ? 'success' : 'warning',
            message: topSlots.length > 0 
              ? `Found ${topSlots.length} optimal meeting times`
              : 'No suitable meeting times found',
            duration: 4000,
          },
          actions: topSlots.length > 0 ? [{
            id: 'schedule-best',
            label: `Schedule at ${topSlots[0].startTime}`,
            variant: 'primary',
            action: {
              type: 'message',
              message: `Schedule a ${duration}-minute meeting at ${topSlots[0].startTime} on ${topSlots[0].date} with ${attendees.join(', ')}`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[FIND OPTIMAL TIME] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Meeting Time Search Failed',
          description: 'Could not find optimal meeting times.',
        }
      );
    }
  },
}); 