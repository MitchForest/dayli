import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { createServerActionClient } from '@/lib/supabase-server';

const emailBacklogSchema = z.object({
  emailId: z.string(),
  subject: z.string(),
  fromEmail: z.string(),
  snippet: z.string(),
  urgency: z.enum(['urgent', 'can_wait', 'no_response']),
  importance: z.enum(['important', 'not_important', 'archive']),
});

const backlogOperationSchema = z.enum(['add', 'remove', 'update_aging']);

export const updateEmailBacklog = tool({
  description: 'Manage email backlog - add, remove, or update aging information',
  parameters: z.object({
    operation: backlogOperationSchema.describe('Operation to perform'),
    emails: z.array(emailBacklogSchema).describe('Emails to process'),
    userId: z.string().optional().describe('User ID (defaults to current user)'),
  }),
  execute: async ({ operation, emails, userId }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'updateEmailBacklog',
      operation: operation === 'add' ? 'create' as const : operation === 'remove' ? 'delete' as const : 'update' as const,
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
      
      let results = { added: 0, removed: 0, updated: 0, errors: [] as string[] };
      
      switch (operation) {
        case 'add':
          // Add emails to backlog
          for (const email of emails) {
            const { error } = await supabase
              .from('email_backlog')
              .upsert({
                user_id: userId,
                email_id: email.emailId,
                subject: email.subject,
                from_email: email.fromEmail,
                snippet: email.snippet,
                urgency: email.urgency,
                importance: email.importance,
                days_in_backlog: 0,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,email_id',
              });
            
            if (error) {
              results.errors.push(`Failed to add ${email.emailId}: ${error.message}`);
            } else {
              results.added++;
            }
          }
          break;
          
        case 'remove':
          // Remove emails from backlog
          const emailIds = emails.map(e => e.emailId);
          const { error } = await supabase
            .from('email_backlog')
            .delete()
            .eq('user_id', userId)
            .in('email_id', emailIds);
          
          if (error) {
            results.errors.push(`Failed to remove emails: ${error.message}`);
          } else {
            results.removed = emails.length;
          }
          break;
          
        case 'update_aging':
          // Update aging information for all backlog emails
          const { data: backlogEmails, error: fetchError } = await supabase
            .from('email_backlog')
            .select('*')
            .eq('user_id', userId);
          
          if (!fetchError && backlogEmails) {
            for (const backlogEmail of backlogEmails) {
              const createdAt = backlogEmail.created_at || new Date().toISOString();
              const daysOld = Math.floor(
                (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
              );
              
              await supabase
                .from('email_backlog')
                .update({
                  days_in_backlog: daysOld,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', backlogEmail.id);
            }
            results.updated = backlogEmails.length;
          }
          break;
      }
      
      // Get updated summary
      const { data: summary } = await supabase
        .from('email_backlog')
        .select('urgency, importance')
        .eq('user_id', userId);
      
      const urgencyCounts = {
        urgent: summary?.filter((e: any) => e.urgency === 'urgent').length || 0,
        can_wait: summary?.filter((e: any) => e.urgency === 'can_wait').length || 0,
        no_response: summary?.filter((e: any) => e.urgency === 'no_response').length || 0,
      };
      
      return buildToolResponse(
        toolOptions,
        {
          operation,
          results,
          summary: {
            total: summary?.length || 0,
            byUrgency: urgencyCounts,
          },
        },
        {
          type: 'card',
          title: 'Email Backlog Updated',
          description: getOperationDescription(operation, results),
          priority: urgencyCounts.urgent > 5 ? 'high' : 'medium',
          components: [{
            type: 'progressIndicator',
            data: {
              current: urgencyCounts.urgent,
              total: summary?.length || 0,
              label: 'Urgent emails in backlog',
              percentage: summary?.length ? (urgencyCounts.urgent / summary.length) * 100 : 0,
            },
          }],
        },
        {
          suggestions: [
            urgencyCounts.urgent > 0 ? 'Process urgent emails' : null,
            summary?.length && summary.length > 20 ? 'Archive old emails' : null,
            'Get backlog summary',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: results.errors.length > 0 ? 'warning' : 'success',
            message: getOperationDescription(operation, results),
            duration: 3000,
          },
        }
      );
      
    } catch (error) {
      console.error('[UPDATE EMAIL BACKLOG] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Backlog Update Failed',
          description: 'Could not update email backlog.',
        }
      );
    }
  },
});

function getOperationDescription(
  operation: z.infer<typeof backlogOperationSchema>,
  results: { added: number; removed: number; updated: number; errors: string[] }
): string {
  switch (operation) {
    case 'add':
      return `Added ${results.added} emails to backlog${results.errors.length ? ` (${results.errors.length} errors)` : ''}`;
    case 'remove':
      return `Removed ${results.removed} emails from backlog`;
    case 'update_aging':
      return `Updated aging for ${results.updated} emails`;
    default:
      return 'Backlog operation completed';
  }
} 