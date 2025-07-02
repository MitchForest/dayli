import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseISO, format, differenceInMinutes, isSameDay } from 'date-fns';

interface ConsolidationOpportunity {
  id: string;
  type: 'combine' | 'batch' | 'reduce' | 'eliminate';
  meetings: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    attendees?: string[];
  }>;
  suggestion: string;
  timeSaved: number; // minutes
  feasibility: 'high' | 'medium' | 'low';
  action: string;
}

export const suggestMeetingConsolidation = tool({
  description: 'Identify opportunities to consolidate or batch similar meetings',
  parameters: z.object({
    dateRange: z.object({
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
    }),
    aggressiveness: z.enum(['conservative', 'moderate', 'aggressive'])
      .optional().default('moderate')
      .describe('How aggressively to suggest consolidations'),
  }),
  execute: async ({ dateRange, aggressiveness }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'suggestMeetingConsolidation',
      operation: 'read' as const,
      resourceType: 'meeting' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const calendarService = ServiceFactory.getInstance().getCalendarService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get all meetings in date range
      const calendarEvents = await calendarService.listEvents({
        calendarId: 'primary',
        timeMin: parseISO(dateRange.startDate).toISOString(),
        timeMax: parseISO(dateRange.endDate).toISOString(),
        maxResults: 250,
      });
      
      const meetings = (calendarEvents.items || []).map((event: any) => ({
        id: event.id,
        title: event.summary || 'Untitled',
        startTime: event.start?.dateTime || event.start?.date,
        endTime: event.end?.dateTime || event.end?.date,
        attendees: event.attendees?.map((a: any) => a.email) || [],
        description: event.description || '',
        recurring: !!event.recurringEventId,
      }));
      
      const opportunities: ConsolidationOpportunity[] = [];
      
      // 1. Find meetings with same attendees that could be combined
      const meetingsByAttendees = new Map<string, typeof meetings>();
      
      meetings.forEach(meeting => {
        const attendeeKey = meeting.attendees.sort().join(',');
        if (!meetingsByAttendees.has(attendeeKey)) {
          meetingsByAttendees.set(attendeeKey, []);
        }
        meetingsByAttendees.get(attendeeKey)?.push(meeting);
      });
      
      meetingsByAttendees.forEach((samePeopleMeetings, attendeeKey) => {
        if (samePeopleMeetings.length >= 2) {
          // Group by day
          const byDay = new Map<string, typeof samePeopleMeetings>();
          
          samePeopleMeetings.forEach(meeting => {
            const day = format(parseISO(meeting.startTime), 'yyyy-MM-dd');
            if (!byDay.has(day)) {
              byDay.set(day, []);
            }
            byDay.get(day)?.push(meeting);
          });
          
          byDay.forEach((dayMeetings, day) => {
            if (dayMeetings.length >= 2) {
              const totalTime = dayMeetings.reduce((sum, m) => 
                sum + differenceInMinutes(parseISO(m.endTime), parseISO(m.startTime)), 0
              );
              
              const timeSaved = Math.round(totalTime * 0.2); // Estimate 20% time savings
              
              opportunities.push({
                id: `combine-${day}-${attendeeKey.slice(0, 8)}`,
                type: 'combine',
                meetings: dayMeetings.slice(0, 3),
                suggestion: `Combine ${dayMeetings.length} meetings with same attendees on ${format(parseISO(day), 'MMM d')}`,
                timeSaved,
                feasibility: dayMeetings.length <= 3 ? 'high' : 'medium',
                action: `Merge into one ${Math.round(totalTime * 0.8)}-minute meeting`,
              });
            }
          });
        }
      });
      
      // 2. Find similar topic meetings that could be batched
      const topicKeywords = ['sync', 'standup', 'review', 'planning', 'retro', '1:1', 'check-in'];
      const meetingsByTopic = new Map<string, typeof meetings>();
      
      meetings.forEach(meeting => {
        const title = meeting.title.toLowerCase();
        const matchedTopic = topicKeywords.find(keyword => title.includes(keyword));
        
        if (matchedTopic) {
          if (!meetingsByTopic.has(matchedTopic)) {
            meetingsByTopic.set(matchedTopic, []);
          }
          meetingsByTopic.get(matchedTopic)?.push(meeting);
        }
      });
      
      meetingsByTopic.forEach((topicMeetings, topic) => {
        if (topicMeetings.length >= 3) {
          const weeklyGroups = new Map<string, typeof topicMeetings>();
          
          topicMeetings.forEach(meeting => {
            const week = format(parseISO(meeting.startTime), 'yyyy-ww');
            if (!weeklyGroups.has(week)) {
              weeklyGroups.set(week, []);
            }
            weeklyGroups.get(week)?.push(meeting);
          });
          
          weeklyGroups.forEach((weekMeetings, week) => {
            if (weekMeetings.length >= 3) {
              opportunities.push({
                id: `batch-${topic}-${week}`,
                type: 'batch',
                meetings: weekMeetings.slice(0, 4),
                suggestion: `Batch ${weekMeetings.length} "${topic}" meetings in week ${week.split('-')[1]}`,
                timeSaved: weekMeetings.length * 10, // Save transition time
                feasibility: 'medium',
                action: `Schedule back-to-back or combine into longer session`,
              });
            }
          });
        }
      });
      
      // 3. Find short recurring meetings that could be reduced
      const shortRecurring = meetings.filter(m => 
        m.recurring && 
        differenceInMinutes(parseISO(m.endTime), parseISO(m.startTime)) <= 30
      );
      
      if (shortRecurring.length >= 5 && aggressiveness !== 'conservative') {
        opportunities.push({
          id: 'reduce-short-recurring',
          type: 'reduce',
          meetings: shortRecurring.slice(0, 5),
          suggestion: 'Reduce frequency of short recurring meetings',
          timeSaved: shortRecurring.length * 15,
          feasibility: 'medium',
          action: 'Change from weekly to bi-weekly or monthly',
        });
      }
      
      // 4. Find potentially eliminable meetings (aggressive mode)
      if (aggressiveness === 'aggressive') {
        const lowEngagementMeetings = meetings.filter(m => {
          const duration = differenceInMinutes(parseISO(m.endTime), parseISO(m.startTime));
          return duration >= 60 && m.attendees.length >= 5; // Large, long meetings
        });
        
        if (lowEngagementMeetings.length > 0) {
          opportunities.push({
            id: 'eliminate-low-value',
            type: 'eliminate',
            meetings: lowEngagementMeetings.slice(0, 3),
            suggestion: 'Consider eliminating large group meetings',
            timeSaved: lowEngagementMeetings.reduce((sum, m) => 
              sum + differenceInMinutes(parseISO(m.endTime), parseISO(m.startTime)), 0
            ),
            feasibility: 'low',
            action: 'Replace with async updates or smaller focused meetings',
          });
        }
      }
      
      // Sort by time saved
      opportunities.sort((a, b) => b.timeSaved - a.timeSaved);
      
      const totalTimeSaved = opportunities.reduce((sum, opp) => sum + opp.timeSaved, 0);
      
      return buildToolResponse(
        toolOptions,
        {
          dateRange,
          opportunities: opportunities.slice(0, 10),
          summary: {
            totalOpportunities: opportunities.length,
            potentialTimeSaved: totalTimeSaved,
            hoursReclaimed: Math.round(totalTimeSaved / 60),
            meetingsAnalyzed: meetings.length,
          },
        },
        {
          type: 'list',
          title: 'Meeting Consolidation Opportunities',
          description: `Found ${opportunities.length} ways to save ${Math.round(totalTimeSaved / 60)} hours`,
          priority: opportunities.length > 5 ? 'high' : 'medium',
          components: opportunities.slice(0, 3).map(opp => ({
            type: 'confirmationDialog',
            data: {
              title: opp.suggestion,
              message: opp.action,
              confirmText: 'Apply This',
              cancelText: 'Skip',
              variant: opp.feasibility === 'high' ? 'info' : 'warning',
            },
          })),
        },
        {
          suggestions: opportunities.length > 0 ? [
            'Apply high-feasibility consolidations first',
            'Review with affected attendees',
            'Set up recurring meeting audits',
            'Create meeting-free focus blocks',
          ] : [
            'Your meeting schedule is already well-optimized',
            'Consider setting meeting duration defaults',
            'Implement no-meeting days',
          ],
          notification: {
            show: true,
            type: opportunities.length > 0 ? 'success' : 'info',
            message: opportunities.length > 0 
              ? `Save ${Math.round(totalTimeSaved / 60)} hours by consolidating meetings`
              : 'Meeting schedule is already efficient',
            duration: 5000,
          },
          actions: opportunities.length > 0 ? [{
            id: 'apply-top',
            label: 'Apply Top Suggestion',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Apply consolidation: ${opportunities[0]?.suggestion}`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[CONSOLIDATION] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Consolidation Analysis Failed',
          description: 'Could not analyze meeting consolidation opportunities.',
        }
      );
    }
  },
}); 