import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { createServerActionClient } from '@/lib/supabase-server';
import { formatDistanceToNow } from 'date-fns';

export const getEmailBacklogSummary = tool({
  description: 'Get comprehensive email backlog summary with health metrics',
  parameters: z.object({
    userId: z.string().optional().describe('User ID (defaults to current user)'),
    includeDetails: z.boolean().optional().default(false).describe('Include detailed email list'),
  }),
  execute: async ({ userId, includeDetails }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'getEmailBacklogSummary',
      operation: 'read' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const supabase = await createServerActionClient();
      
      // Get current user if not provided
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');
        userId = user.id;
      }
      
      // Get all backlog emails
      const { data: backlogEmails, error } = await supabase
        .from('email_backlog')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (!backlogEmails || backlogEmails.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            summary: {
              total: 0,
              byUrgency: { urgent: 0, can_wait: 0, no_response: 0 },
              byImportance: { important: 0, not_important: 0, archive: 0 },
              avgDaysInBacklog: 0,
              oldestEmail: null,
              staleEmails: 0,
            },
          },
          {
            type: 'card',
            title: 'Email Backlog Empty',
            description: 'No emails in backlog - inbox zero achieved!',
            priority: 'low',
            components: [],
          },
          {
            suggestions: ['Check inbox for new emails'],
            notification: {
              show: true,
              type: 'success',
              message: 'Email backlog is empty!',
              duration: 3000,
            },
          }
        );
      }
      
      // Calculate metrics
      const now = new Date();
      const urgencyCounts = {
        urgent: backlogEmails.filter(e => e.urgency === 'urgent').length,
        can_wait: backlogEmails.filter(e => e.urgency === 'can_wait').length,
        no_response: backlogEmails.filter(e => e.urgency === 'no_response').length,
      };
      
      const importanceCounts = {
        important: backlogEmails.filter(e => e.importance === 'important').length,
        not_important: backlogEmails.filter(e => e.importance === 'not_important').length,
        archive: backlogEmails.filter(e => e.importance === 'archive').length,
      };
      
      // Calculate aging metrics
      const daysInBacklog = backlogEmails.map(e => {
        const createdAt = e.created_at || new Date().toISOString();
        return Math.floor((now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
      });
      
      const avgDaysInBacklog = Math.round(
        daysInBacklog.reduce((sum, days) => sum + days, 0) / daysInBacklog.length
      );
      
      const staleEmails = daysInBacklog.filter(days => days > 7).length;
      const oldestEmail = backlogEmails[backlogEmails.length - 1];
      
      // Identify problem areas
      const problems = [];
      if (urgencyCounts.urgent > 5) {
        problems.push(`${urgencyCounts.urgent} urgent emails need attention`);
      }
      if (staleEmails > 10) {
        problems.push(`${staleEmails} emails are over a week old`);
      }
      if (avgDaysInBacklog > 5) {
        problems.push(`Average email age is ${avgDaysInBacklog} days`);
      }
      
      const healthScore = calculateHealthScore(
        backlogEmails.length,
        urgencyCounts.urgent,
        staleEmails,
        avgDaysInBacklog
      );
      
      return buildToolResponse(
        toolOptions,
        {
          summary: {
            total: backlogEmails.length,
            byUrgency: urgencyCounts,
            byImportance: importanceCounts,
            avgDaysInBacklog,
            oldestEmail: oldestEmail ? {
              subject: oldestEmail.subject,
              from: oldestEmail.from_email,
              age: formatDistanceToNow(new Date(oldestEmail.created_at || now)),
            } : null,
            staleEmails,
            healthScore,
            problems,
          },
          emails: includeDetails ? backlogEmails : undefined,
        },
        {
          type: 'card',
          title: 'Email Backlog Summary',
          description: `${backlogEmails.length} emails in backlog (${urgencyCounts.urgent} urgent)`,
          priority: urgencyCounts.urgent > 5 || staleEmails > 10 ? 'high' : 'medium',
          components: [
            {
              type: 'progressIndicator',
              data: {
                current: urgencyCounts.urgent,
                total: backlogEmails.length,
                label: 'Urgent emails',
                percentage: (urgencyCounts.urgent / backlogEmails.length) * 100,
              },
            },
            {
              type: 'progressIndicator',
              data: {
                current: healthScore,
                total: 100,
                label: 'Backlog health score',
                percentage: healthScore,
              },
            },
          ],
        },
        {
          suggestions: [
            urgencyCounts.urgent > 0 ? `Process ${urgencyCounts.urgent} urgent emails` : null,
            staleEmails > 0 ? `Archive ${staleEmails} old emails` : null,
            importanceCounts.archive > 5 ? 'Batch archive low-priority emails' : null,
            'Create email processing schedule',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: healthScore < 50 ? 'warning' : 'info',
            message: healthScore < 50 
              ? `Backlog needs attention: ${problems[0] || 'Multiple issues'}`
              : `Backlog health: ${healthScore}%`,
            duration: 4000,
          },
          actions: urgencyCounts.urgent > 0 ? [{
            id: 'process-urgent',
            label: 'Process Urgent Emails',
            variant: 'primary',
            action: {
              type: 'message',
              message: 'Show me urgent emails from my backlog',
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[GET EMAIL BACKLOG SUMMARY] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Summary Failed',
          description: 'Could not retrieve email backlog summary.',
        }
      );
    }
  },
});

function calculateHealthScore(
  total: number,
  urgent: number,
  stale: number,
  avgDays: number
): number {
  // Start with 100 and deduct points for issues
  let score = 100;
  
  // Deduct for total volume
  if (total > 50) score -= 20;
  else if (total > 30) score -= 10;
  else if (total > 20) score -= 5;
  
  // Deduct for urgent emails
  if (urgent > 10) score -= 30;
  else if (urgent > 5) score -= 20;
  else if (urgent > 2) score -= 10;
  
  // Deduct for stale emails
  if (stale > 20) score -= 25;
  else if (stale > 10) score -= 15;
  else if (stale > 5) score -= 10;
  
  // Deduct for average age
  if (avgDays > 7) score -= 20;
  else if (avgDays > 5) score -= 10;
  else if (avgDays > 3) score -= 5;
  
  return Math.max(0, Math.min(100, score));
} 