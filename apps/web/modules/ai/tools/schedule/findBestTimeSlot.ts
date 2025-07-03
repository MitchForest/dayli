import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, differenceInMinutes, format, addDays } from 'date-fns';

interface TimeSlotCandidate {
  date: string;
  startTime: string;
  endTime: string;
  score: number;
  factors: {
    energyAlignment: number;
    minimumDisruption: number;
    contextMatch: number;
    preferenceMatch: number;
  };
  reasoning: string;
}

export const findBestTimeSlot = tool({
  description: 'Find optimal time slot for a specific activity based on preferences and energy patterns',
  parameters: z.object({
    activityType: z.enum(['deep_work', 'meetings', 'creative', 'administrative', 'learning'])
      .describe('Type of activity to schedule'),
    durationMinutes: z.number().describe('Required duration in minutes'),
    dateRange: z.object({
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
    }).optional(),
    constraints: z.object({
      mustBeAfter: z.string().optional().describe('Must be after this time (HH:MM)'),
      mustBeBefore: z.string().optional().describe('Must be before this time (HH:MM)'),
      preferMorning: z.boolean().optional(),
      preferAfternoon: z.boolean().optional(),
      avoidMeetingDays: z.boolean().optional(),
    }).optional(),
  }),
  execute: async ({ activityType, durationMinutes, dateRange, constraints = {} }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'findBestTimeSlot',
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
      
      // Get user preferences
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      // Default date range if not provided
      const today = new Date();
      const startDate = dateRange ? parseISO(dateRange.startDate) : today;
      const endDate = dateRange ? parseISO(dateRange.endDate) : addDays(today, 7);
      
      const candidates: TimeSlotCandidate[] = [];
      
      // Check each day in range
      for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        // Get existing schedule
        const blocks = await scheduleService.getScheduleForDate(dateStr);
        
        // Get calendar events
        const calendarResponse = await calendarService.listEvents({
          calendarId: 'primary',
          timeMin: `${dateStr}T00:00:00Z`,
          timeMax: `${dateStr}T23:59:59Z`,
        });
        const events = calendarResponse.items || [];
        
        // Skip days with many meetings if requested
        if (constraints.avoidMeetingDays && events.length >= 3) continue;
        
        // Find gaps in schedule
        const busyTimes = [
          ...blocks.map(b => ({
            start: b.startTime,
            end: b.endTime,
          })),
          ...events
            .filter((e: any) => e.start?.dateTime)
            .map((e: any) => ({
              start: parseISO(e.start.dateTime),
              end: parseISO(e.end.dateTime),
            })),
        ].sort((a, b) => a.start.getTime() - b.start.getTime());
        
        // Find available slots
        const workStart = preferences?.work_start_time || '09:00';
        const workEnd = preferences?.work_end_time || '17:00';
        const dayStart = parseISO(`${dateStr}T${workStart}`);
        const dayEnd = parseISO(`${dateStr}T${workEnd}`);
        
        // Check start of day
        const firstBusyTime = busyTimes[0];
        if (busyTimes.length === 0 || (firstBusyTime && firstBusyTime.start > dayStart)) {
          const slotEnd = busyTimes.length > 0 && firstBusyTime ? firstBusyTime.start : dayEnd;
          const slotDuration = differenceInMinutes(slotEnd, dayStart);
          
          if (slotDuration >= durationMinutes) {
            const candidate = evaluateSlot(
              dateStr,
              format(dayStart, 'HH:mm'),
              format(new Date(dayStart.getTime() + durationMinutes * 60000), 'HH:mm'),
              activityType,
              preferences,
              constraints
            );
            candidates.push(candidate);
          }
        }
        
        // Check between busy times
        for (let i = 0; i < busyTimes.length - 1; i++) {
          const current = busyTimes[i];
          const next = busyTimes[i + 1];
          if (!current || !next) continue;
          
          const gapStart = current.end;
          const gapEnd = next.start;
          const gapDuration = differenceInMinutes(gapEnd, gapStart);
          
          if (gapDuration >= durationMinutes) {
            const candidate = evaluateSlot(
              dateStr,
              format(gapStart, 'HH:mm'),
              format(new Date(gapStart.getTime() + durationMinutes * 60000), 'HH:mm'),
              activityType,
              preferences,
              constraints
            );
            candidates.push(candidate);
          }
        }
        
        // Check end of day
        if (busyTimes.length > 0) {
          const lastBusyTime = busyTimes[busyTimes.length - 1];
          if (!lastBusyTime) continue;
          
          const lastEnd = lastBusyTime.end;
          if (lastEnd < dayEnd) {
            const slotDuration = differenceInMinutes(dayEnd, lastEnd);
            if (slotDuration >= durationMinutes) {
              const candidate = evaluateSlot(
                dateStr,
                format(lastEnd, 'HH:mm'),
                format(new Date(lastEnd.getTime() + durationMinutes * 60000), 'HH:mm'),
                activityType,
                preferences,
                constraints
              );
              candidates.push(candidate);
            }
          }
        }
      }
      
      // Sort candidates by score
      candidates.sort((a, b) => b.score - a.score);
      const topCandidates = candidates.slice(0, 5);
      
      return buildToolResponse(
        toolOptions,
        {
          activityType,
          durationMinutes,
          candidates: topCandidates,
          bestSlot: topCandidates[0],
          totalCandidates: candidates.length,
        },
        {
          type: 'list',
          title: 'Best Time Slots Found',
          description: `Found ${candidates.length} possible slots for ${activityType.replace('_', ' ')}`,
          priority: 'medium',
          components: topCandidates.slice(0, 3).map(slot => ({
            type: 'scheduleBlock',
            data: {
              id: `slot-${slot.date}-${slot.startTime}`,
              type: activityType === 'meetings' ? 'meeting' : 'work',
              title: `${activityType.replace('_', ' ')} - Score: ${slot.score}`,
              startTime: slot.startTime,
              endTime: slot.endTime,
              description: slot.reasoning,
            },
          })),
        },
        {
          suggestions: topCandidates.length > 0 && topCandidates[0] ? [
            `Schedule ${activityType.replace('_', ' ')} at ${topCandidates[0].startTime} on ${topCandidates[0].date}`,
            'Block this time on your calendar',
            'Create a recurring block for this activity',
            'Find alternative times',
          ] : [
            'Expand date range to find more options',
            'Reduce duration requirement',
            'Adjust constraints',
          ],
          notification: {
            show: true,
            type: topCandidates.length > 0 ? 'success' : 'warning',
            message: topCandidates.length > 0
              ? `Found ${topCandidates.length} optimal time slots`
              : 'No suitable time slots found',
            duration: 4000,
          },
          actions: topCandidates.length > 0 && topCandidates[0] ? [{
            id: 'schedule-best',
            label: `Schedule at ${topCandidates[0].startTime}`,
            variant: 'primary',
            action: {
              type: 'message',
              message: `Create a ${durationMinutes}-minute ${activityType.replace('_', ' ')} block at ${topCandidates[0].startTime} on ${topCandidates[0].date}`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[FIND BEST SLOT] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Time Slot Search Failed',
          description: 'Could not find optimal time slots.',
        }
      );
    }
  },
});

function evaluateSlot(
  date: string,
  startTime: string,
  endTime: string,
  activityType: string,
  preferences: any,
  constraints: any
): TimeSlotCandidate {
  const timeParts = startTime.split(':');
  const hour = parseInt(timeParts[0] || '0');
  let score = 50; // Base score
  const factors = {
    energyAlignment: 0,
    minimumDisruption: 0,
    contextMatch: 0,
    preferenceMatch: 0,
  };
  
  // Energy alignment scoring
  if (activityType === 'deep_work' || activityType === 'creative') {
    if (hour >= 9 && hour < 11) {
      factors.energyAlignment = 30;
      score += 30;
    } else if (hour >= 7 && hour < 9) {
      factors.energyAlignment = 20;
      score += 20;
    }
  } else if (activityType === 'meetings') {
    if (hour >= 14 && hour < 16) {
      factors.energyAlignment = 25;
      score += 25;
    }
  } else if (activityType === 'administrative') {
    if (hour >= 13 && hour < 15) {
      factors.energyAlignment = 20;
      score += 20;
    }
  }
  
  // Preference matching
  if (constraints.preferMorning && hour < 12) {
    factors.preferenceMatch = 15;
    score += 15;
  } else if (constraints.preferAfternoon && hour >= 12) {
    factors.preferenceMatch = 15;
    score += 15;
  }
  
  // Time constraint matching
  if (constraints.mustBeAfter && startTime < constraints.mustBeAfter) {
    score -= 50; // Heavily penalize
  }
  if (constraints.mustBeBefore && endTime > constraints.mustBeBefore) {
    score -= 50; // Heavily penalize
  }
  
  // Context matching (e.g., deep work in quiet hours)
  if (activityType === 'deep_work' && (hour < 9 || hour > 16)) {
    factors.contextMatch = 10;
    score += 10;
  }
  
  // Generate reasoning
  const reasons = [];
  if (factors.energyAlignment > 20) {
    reasons.push('High energy alignment');
  }
  if (factors.preferenceMatch > 0) {
    reasons.push('Matches time preference');
  }
  if (hour < 10) {
    reasons.push('Early morning focus');
  }
  
  return {
    date,
    startTime,
    endTime,
    score: Math.max(0, Math.min(100, score)),
    factors,
    reasoning: reasons.join(', ') || 'Standard time slot',
  };
} 