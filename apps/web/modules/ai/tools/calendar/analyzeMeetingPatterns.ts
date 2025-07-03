import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { startOfWeek, endOfWeek, parseISO, differenceInMinutes, format } from 'date-fns';

interface MeetingPattern {
  type: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  frequency: number;
  examples: string[];
  recommendation?: string;
}

export const analyzeMeetingPatterns = tool({
  description: 'Analyze meeting patterns to identify inefficiencies and optimization opportunities',
  parameters: z.object({
    timeRange: z.enum(['week', 'month', 'quarter']).optional().default('month')
      .describe('Time range to analyze'),
    includeCalendar: z.boolean().optional().default(true)
      .describe('Include Google Calendar events'),
    includeSchedule: z.boolean().optional().default(true)
      .describe('Include schedule blocks'),
  }),
  execute: async ({ timeRange, includeCalendar, includeSchedule }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'analyzeMeetingPatterns',
      operation: 'read' as const,
      resourceType: 'meeting' as const,
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
      
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      let endDate = now;
      
      switch (timeRange) {
        case 'week':
          startDate = startOfWeek(now);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
      }
      
      // Collect all meetings
      const meetings: Array<{
        id: string;
        title: string;
        startTime: Date;
        endTime: Date;
        duration: number;
        type: 'calendar' | 'schedule';
        attendees?: string[];
        recurring?: boolean;
      }> = [];
      
      // Get calendar events
      if (includeCalendar) {
        const calendarEvents = await calendarService.listEvents({
          calendarId: 'primary',
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          maxResults: 250,
        });
        
        meetings.push(...(calendarEvents.items || []).map((event: any) => ({
          id: event.id,
          title: event.summary || 'Untitled',
          startTime: parseISO(event.start?.dateTime || event.start?.date),
          endTime: parseISO(event.end?.dateTime || event.end?.date),
          duration: differenceInMinutes(
            parseISO(event.end?.dateTime || event.end?.date),
            parseISO(event.start?.dateTime || event.start?.date)
          ),
          type: 'calendar' as const,
          attendees: event.attendees?.map((a: any) => a.email) || [],
          recurring: !!event.recurringEventId,
        })));
      }
      
      // Get schedule blocks
      if (includeSchedule) {
        const blocks = await scheduleService.getScheduleForDateRange(
          format(startDate, 'yyyy-MM-dd'),
          format(endDate, 'yyyy-MM-dd')
        );
        
        meetings.push(...blocks.filter(b => b.type === 'meeting').map(block => ({
          id: block.id,
          title: block.title,
          startTime: block.startTime,
          endTime: block.endTime,
          duration: differenceInMinutes(block.endTime, block.startTime),
          type: 'schedule' as const,
        })));
      }
      
      // Analyze patterns
      const patterns: MeetingPattern[] = [];
      
      // 1. Back-to-back meetings
      const backToBackDays = new Map<string, number>();
      meetings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      for (let i = 0; i < meetings.length - 1; i++) {
        const current = meetings[i];
        const next = meetings[i + 1];
        
        if (!current || !next) continue;
        
        const gap = differenceInMinutes(next.startTime, current.endTime);
        if (gap <= 5 && format(current.startTime, 'yyyy-MM-dd') === format(next.startTime, 'yyyy-MM-dd')) {
          const day = format(current.startTime, 'yyyy-MM-dd');
          backToBackDays.set(day, (backToBackDays.get(day) || 0) + 1);
        }
      }
      
      if (backToBackDays.size > 0) {
        patterns.push({
          type: 'back_to_back',
          description: 'Frequent back-to-back meetings without breaks',
          impact: 'negative',
          frequency: backToBackDays.size,
          examples: Array.from(backToBackDays.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([day, count]) => `${format(parseISO(day), 'MMM d')}: ${count} consecutive meetings`),
          recommendation: 'Add 15-minute buffers between meetings for transitions',
        });
      }
      
      // 2. Meeting-heavy days
      const meetingsPerDay = new Map<string, number>();
      meetings.forEach(meeting => {
        const day = format(meeting.startTime, 'yyyy-MM-dd');
        meetingsPerDay.set(day, (meetingsPerDay.get(day) || 0) + 1);
      });
      
      const heavyDays = Array.from(meetingsPerDay.entries())
        .filter(([_, count]) => count >= 5);
      
      if (heavyDays.length > 0) {
        patterns.push({
          type: 'meeting_heavy_days',
          description: 'Days with excessive meetings (5+ per day)',
          impact: 'negative',
          frequency: heavyDays.length,
          examples: heavyDays
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([day, count]) => `${format(parseISO(day), 'MMM d')}: ${count} meetings`),
          recommendation: 'Implement meeting-free blocks or days',
        });
      }
      
      // 3. Short meetings
      const shortMeetings = meetings.filter(m => m.duration <= 30);
      if (shortMeetings.length > meetings.length * 0.3) {
        patterns.push({
          type: 'short_meetings',
          description: 'Many meetings are 30 minutes or less',
          impact: 'positive',
          frequency: shortMeetings.length,
          examples: shortMeetings
            .slice(0, 3)
            .map(m => `"${m.title}" (${m.duration} min)`),
          recommendation: 'Good practice! Consider if some could be emails or async',
        });
      }
      
      // 4. Long meetings
      const longMeetings = meetings.filter(m => m.duration >= 90);
      if (longMeetings.length > 0) {
        patterns.push({
          type: 'long_meetings',
          description: 'Meetings lasting 90+ minutes',
          impact: 'negative',
          frequency: longMeetings.length,
          examples: longMeetings
            .slice(0, 3)
            .map(m => `"${m.title}" (${Math.round(m.duration / 60)} hours)`),
          recommendation: 'Break long meetings into shorter focused sessions',
        });
      }
      
      // 5. Recurring meeting load
      const recurringMeetings = meetings.filter(m => m.recurring);
      if (recurringMeetings.length > meetings.length * 0.4) {
        patterns.push({
          type: 'high_recurring',
          description: 'High percentage of recurring meetings',
          impact: 'neutral',
          frequency: recurringMeetings.length,
          examples: [...new Set(recurringMeetings.map(m => m.title))].slice(0, 3),
          recommendation: 'Review recurring meetings quarterly for relevance',
        });
      }
      
      // Calculate statistics
      const totalMeetingTime = meetings.reduce((sum, m) => sum + m.duration, 0);
      const avgMeetingDuration = meetings.length > 0 ? totalMeetingTime / meetings.length : 0;
      const avgMeetingsPerDay = meetings.length / Math.max(1, differenceInMinutes(endDate, startDate) / (60 * 24));
      
      return buildToolResponse(
        toolOptions,
        {
          timeRange,
          patterns,
          statistics: {
            totalMeetings: meetings.length,
            totalHours: Math.round(totalMeetingTime / 60),
            avgDuration: Math.round(avgMeetingDuration),
            avgPerDay: Math.round(avgMeetingsPerDay * 10) / 10,
            recurringPercentage: meetings.length > 0 
              ? Math.round((recurringMeetings.length / meetings.length) * 100)
              : 0,
          },
        },
        {
          type: 'list',
          title: 'Meeting Pattern Analysis',
          description: `Analyzed ${meetings.length} meetings over ${timeRange}`,
          priority: patterns.some(p => p.impact === 'negative') ? 'high' : 'medium',
          components: patterns.slice(0, 3).map(pattern => ({
            type: 'progressIndicator',
            data: {
              label: pattern.description,
              percentage: Math.min(100, (pattern.frequency / meetings.length) * 100),
              current: pattern.frequency,
              total: meetings.length,
            },
          })),
        },
        {
          suggestions: [
            'Implement meeting-free focus blocks',
            'Review and cancel unnecessary recurring meetings',
            'Add buffer time between meetings',
            'Set meeting duration defaults to 25/50 minutes',
          ],
          notification: {
            show: true,
            type: patterns.some(p => p.impact === 'negative') ? 'warning' : 'info',
            message: `Found ${patterns.length} meeting patterns to review`,
            duration: 4000,
          },
          actions: patterns.some(p => p.impact === 'negative') ? [{
            id: 'optimize-meetings',
            label: 'Optimize Meeting Schedule',
            variant: 'primary',
            action: {
              type: 'message',
              message: 'Help me optimize my meeting schedule based on these patterns',
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[ANALYZE PATTERNS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Pattern Analysis Failed',
          description: 'Could not analyze meeting patterns.',
        }
      );
    }
  },
}); 