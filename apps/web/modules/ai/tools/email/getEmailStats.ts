import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { startOfDay, endOfDay, subDays, format, differenceInMinutes } from 'date-fns';

interface EmailStats {
  dateRange: {
    start: Date;
    end: Date;
    days: number;
  };
  volume: {
    total: number;
    daily: number;
    received: number;
    sent: number;
  };
  patterns: {
    peakHours: { hour: number; count: number }[];
    busiestDays: { day: string; count: number }[];
    quietestDays: { day: string; count: number }[];
  };
  responseTime: {
    average: number | null;
    fastest: number | null;
    slowest: number | null;
  };
  categories: {
    byUrgency: Record<string, number>;
    byImportance: Record<string, number>;
    byLabel: Record<string, number>;
  };
  topSenders: Array<{
    email: string;
    name: string;
    count: number;
    percentOfTotal: number;
  }>;
}

export const getEmailStats = tool({
  description: 'Get email statistics and trends over a time period',
  parameters: z.object({
    days: z.number().optional().default(30).describe('Number of days to analyze'),
    includeResponseTime: z.boolean().optional().default(false).describe('Calculate response times (slower)'),
  }),
  execute: async ({ days, includeResponseTime }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'getEmailStats',
      operation: 'read' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const gmailService = ServiceFactory.getInstance().getGmailService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Define date range
      const endDate = new Date();
      const startDate = subDays(endDate, days);
      
      // Fetch emails in date range
      const query = `after:${format(startDate, 'yyyy/MM/dd')} before:${format(endDate, 'yyyy/MM/dd')}`;
      const result = await gmailService.listMessages({
        q: query,
        maxResults: 500, // Analyze up to 500 emails
      });
      
      if (!result.messages || result.messages.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            stats: null,
            message: `No emails found in the last ${days} days`,
          },
          {
            type: 'card',
            title: 'No Email Activity',
            description: `No emails found in the last ${days} days`,
            priority: 'low',
            components: [],
          },
          {
            suggestions: ['Check email connection', 'Try a different date range'],
          }
        );
      }
      
      // Fetch email details
      const emailDetails = await Promise.all(
        result.messages.map(async (msg) => {
          const fullMessage = await gmailService.getMessage(msg.id);
          if (!fullMessage) return null;
          
          const headers = fullMessage.payload?.headers || [];
          const date = headers.find(h => h.name === 'Date')?.value || '';
          const from = headers.find(h => h.name === 'From')?.value || '';
          const to = headers.find(h => h.name === 'To')?.value || '';
          const subject = headers.find(h => h.name === 'Subject')?.value || '';
          
          const isSent = fullMessage.labelIds?.includes('SENT') || false;
          
          return {
            id: fullMessage.id,
            date: new Date(date),
            from,
            to,
            subject,
            labels: fullMessage.labelIds || [],
            isSent,
          };
        })
      );
      
      const validEmails = emailDetails.filter((e): e is NonNullable<typeof e> => e !== null);
      
      // Calculate volume stats
      const received = validEmails.filter(e => !e.isSent);
      const sent = validEmails.filter(e => e.isSent);
      
      // Hour distribution
      const hourCounts = new Map<number, number>();
      validEmails.forEach(email => {
        const hour = email.date.getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });
      
      const peakHours = Array.from(hourCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour, count]) => ({ hour, count }));
      
      // Day distribution
      const dayCounts = new Map<string, number>();
      validEmails.forEach(email => {
        const day = format(email.date, 'yyyy-MM-dd');
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
      });
      
      const sortedDays = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1]);
      const busiestDays = sortedDays.slice(0, 3).map(([day, count]) => ({ day, count }));
      const quietestDays = sortedDays.slice(-3).reverse().map(([day, count]) => ({ day, count }));
      
      // Sender analysis
      const senderCounts = new Map<string, { name: string; count: number }>();
      received.forEach(email => {
        const emailMatch = email.from.match(/<(.+)>/);
        const emailAddr = emailMatch ? emailMatch[1] : email.from;
        const nameMatch = email.from.match(/^"?([^"<]+)"?\s*</);
        const name = nameMatch?.[1]?.trim() || (emailAddr?.split('@')[0] || 'Unknown');
        
        if (emailAddr) {
          const existing = senderCounts.get(emailAddr) || { name, count: 0 };
          existing.count++;
          senderCounts.set(emailAddr, existing);
        }
      });
      
      const topSenders = Array.from(senderCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([email, { name, count }]) => ({
          email,
          name,
          count,
          percentOfTotal: Math.round((count / received.length) * 100),
        }));
      
      // Get urgency/importance from backlog
      const { data: backlogEmails } = await supabase
        .from('email_backlog')
        .select('urgency, importance')
        .eq('user_id', user.id);
      
      const urgencyCounts = {
        urgent: backlogEmails?.filter(e => e.urgency === 'urgent').length || 0,
        can_wait: backlogEmails?.filter(e => e.urgency === 'can_wait').length || 0,
        no_response: backlogEmails?.filter(e => e.urgency === 'no_response').length || 0,
      };
      
      const importanceCounts = {
        important: backlogEmails?.filter(e => e.importance === 'important').length || 0,
        not_important: backlogEmails?.filter(e => e.importance === 'not_important').length || 0,
        archive: backlogEmails?.filter(e => e.importance === 'archive').length || 0,
      };
      
      const stats: EmailStats = {
        dateRange: {
          start: startDate,
          end: endDate,
          days,
        },
        volume: {
          total: validEmails.length,
          daily: Math.round(validEmails.length / days),
          received: received.length,
          sent: sent.length,
        },
        patterns: {
          peakHours,
          busiestDays,
          quietestDays,
        },
        responseTime: {
          average: null,
          fastest: null,
          slowest: null,
        },
        categories: {
          byUrgency: urgencyCounts,
          byImportance: importanceCounts,
          byLabel: {},
        },
        topSenders,
      };
      
      return buildToolResponse(
        toolOptions,
        { stats },
        {
          type: 'card',
          title: 'Email Statistics',
          description: `${stats.volume.total} emails over ${days} days (${stats.volume.daily}/day average)`,
          priority: 'medium',
          components: [
            {
              type: 'progressIndicator',
              data: {
                current: stats.volume.sent,
                total: stats.volume.total,
                label: 'Sent vs Received',
                percentage: (stats.volume.sent / stats.volume.total) * 100,
              },
            },
          ],
        },
        {
          suggestions: [
            peakHours[0] ? `Schedule email time during peak hour (${peakHours[0].hour}:00)` : null,
            topSenders[0]?.percentOfTotal > 20 ? `Filter emails from ${topSenders[0].name}` : null,
            stats.volume.daily > 50 ? 'Set up email batching' : null,
            'View detailed breakdown',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: 'info',
            message: `Analyzed ${stats.volume.total} emails - ${stats.volume.daily} per day average`,
            duration: 3000,
          },
        }
      );
      
    } catch (error) {
      console.error('[GET EMAIL STATS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Statistics Failed',
          description: 'Could not calculate email statistics.',
        }
      );
    }
  },
}); 