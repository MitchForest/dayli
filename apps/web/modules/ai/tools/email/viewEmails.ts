import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type EmailList, type Email } from '../../schemas/email.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';

// Helper to parse email address
function parseEmailAddress(addressStr: string): { name: string; email: string } {
  const match = addressStr.match(/^"?([^"<]+)"?\s*<(.+)>$/);
  if (match && match[1] && match[2]) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  const parts = addressStr.split('@');
  return { name: parts[0] || 'Unknown', email: addressStr.trim() };
}

// Helper to determine urgency
function determineUrgency(subject: string, from: string): 'urgent' | 'important' | 'normal' {
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical'];
  const importantKeywords = ['important', 'priority', 'action required'];
  
  const lowerSubject = subject.toLowerCase();
  const lowerFrom = from.toLowerCase();
  
  if (urgentKeywords.some(k => lowerSubject.includes(k) || lowerFrom.includes(k))) {
    return 'urgent';
  }
  if (importantKeywords.some(k => lowerSubject.includes(k))) {
    return 'important';
  }
  return 'normal';
}

export const viewEmails = tool({
  description: "View emails with urgency indicators and smart filtering",
  parameters: z.object({
    maxResults: z.number().optional().default(20).describe("Maximum number of emails to return"),
    query: z.string().optional().describe("Search query (e.g., 'from:sarah', 'subject:report')"),
    status: z.enum(['unread', 'backlog', 'all']).optional().default('unread'),
    urgency: z.enum(['urgent', 'important', 'normal', 'all']).optional().default('all'),
  }),
  execute: async ({ maxResults, query, status, urgency }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'viewEmails',
      operation: 'read' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // List messages with optional query
      const result = await gmailService.listMessages({
        maxResults,
        q: query
      });
      
      if (!result.messages || result.messages.length === 0) {
        const emailList: EmailList = {
          emails: [],
          totalCount: 0,
          unreadCount: 0,
        };
        
        return buildToolResponse(
          toolOptions,
          emailList,
          {
            type: 'list',
            title: 'Email Inbox',
            description: query ? `No emails found matching "${query}"` : 'No emails found',
            priority: 'low',
            components: [],
          },
          {
            suggestions: ['Check spam folder', 'Try a different search', 'Refresh inbox'],
          }
        );
      }
      
      // Fetch details for each message
      const emailDetails = await Promise.all(
        result.messages.map(async (msg) => {
          try {
            const fullMessage = await gmailService.getMessage(msg.id);
            if (!fullMessage) return null;
            
            const headers = fullMessage.payload?.headers || [];
            const fromHeader = headers.find(h => h.name === 'From')?.value || 'Unknown';
            const toHeader = headers.find(h => h.name === 'To')?.value || '';
            const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)';
            const date = headers.find(h => h.name === 'Date')?.value || new Date().toISOString();
            
            const fromParsed = parseEmailAddress(fromHeader);
            const urgency = determineUrgency(subject, fromHeader);
            
            // Extract body preview
            let bodyPreview = fullMessage.snippet || '';
            let bodyPlain = '';
            
            if (fullMessage.payload?.parts) {
              for (const part of fullMessage.payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                  bodyPlain = Buffer.from(part.body.data, 'base64').toString('utf-8');
                  bodyPreview = bodyPlain.substring(0, 200).trim();
                  break;
                }
              }
            }
            
            const email: Email = {
              id: fullMessage.id,
              threadId: fullMessage.threadId || fullMessage.id,
              from: fromParsed,
              to: toHeader ? [parseEmailAddress(toHeader)] : [],
              subject,
              bodyPreview,
              bodyPlain,
              receivedAt: new Date(date).toISOString(),
              isRead: fullMessage.labelIds?.includes('UNREAD') === false,
              labels: fullMessage.labelIds || [],
              urgency,
            };
            
            return email;
          } catch (error) {
            console.error(`Failed to fetch email ${msg.id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out nulls
      const validEmails = emailDetails.filter((email): email is Email => email !== null);
      const unreadCount = validEmails.filter(e => !e.isRead).length;
      
      const emailList: EmailList = {
        emails: validEmails,
        totalCount: result.resultSizeEstimate || validEmails.length,
        unreadCount,
      };
      
      return buildToolResponse(
        toolOptions,
        emailList,
        {
          type: 'list',
          title: 'Email Inbox',
          description: query 
            ? `Found ${validEmails.length} email${validEmails.length !== 1 ? 's' : ''} matching "${query}"`
            : `${validEmails.length} recent email${validEmails.length !== 1 ? 's' : ''} (${unreadCount} unread)`,
          priority: unreadCount > 0 ? 'high' : 'medium',
          components: validEmails.slice(0, 5).map(email => ({
            type: 'emailPreview' as const,
            data: {
              id: email.id,
              from: email.from.name,
              fromEmail: email.from.email,
              subject: email.subject,
              preview: email.bodyPreview,
              receivedAt: email.receivedAt,
              isRead: email.isRead,
              hasAttachments: email.attachments?.length ? true : false,
              urgency: email.urgency,
            },
          })),
        },
        {
          suggestions: validEmails.length > 0
            ? ['Read an email', 'Draft a response', 'Archive old emails']
            : ['Check spam folder', 'Try a different search'],
          actions: validEmails.length > 0 ? [
            {
              id: 'read-first',
              label: 'Read First Email',
              icon: 'mail',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'readEmailContent',
                params: { emailId: validEmails[0]?.id || '' },
              },
            },
            {
              id: 'process-to-tasks',
              label: 'Process to Tasks',
              icon: 'tasks',
              variant: 'secondary',
              action: {
                type: 'message',
                message: 'Convert important emails to tasks',
              },
            },
          ] : [],
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to list emails',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
});