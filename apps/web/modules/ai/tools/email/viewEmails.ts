import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type EmailListResponse } from '../types/responses';
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

// Helper to calculate urgency score
function calculateUrgencyScore(email: any): number {
  let score = 50; // Base score
  
  // Urgency level
  if (email.urgency === 'urgent') score += 40;
  else if (email.urgency === 'important') score += 20;
  
  // Unread emails get priority
  if (!email.isRead) score += 10;
  
  // Time-based scoring (older unread emails might be more urgent)
  const hoursOld = (Date.now() - new Date(email.receivedAt).getTime()) / (1000 * 60 * 60);
  if (!email.isRead && hoursOld > 24) score += 10;
  
  return Math.min(score, 100);
}

export const viewEmails = registerTool(
  createTool<typeof parameters, EmailListResponse>({
    name: 'email_viewEmails',
    description: "View emails with urgency indicators and smart filtering",
    parameters: z.object({
      maxResults: z.number().optional().default(20).describe("Maximum number of emails to return"),
      query: z.string().optional().describe("Search query (e.g., 'from:sarah', 'subject:report')"),
      status: z.enum(['unread', 'backlog', 'all']).optional().default('unread'),
      urgency: z.enum(['urgent', 'important', 'normal', 'all']).optional().default('all'),
    }),
    metadata: {
      category: 'email',
      displayName: 'View Emails',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ maxResults, query, status, urgency }) => {
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // List messages with optional query
      const result = await gmailService.listMessages({
        maxResults,
        q: query
      });
      
      if (!result.messages || result.messages.length === 0) {
        return {
          success: true,
          emails: [],
          stats: {
            total: 0,
            unread: 0,
            urgent: 0,
          },
        };
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
            
            return {
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
              score: 0, // Will calculate later
            };
          } catch (error) {
            console.error(`Failed to fetch email ${msg.id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out nulls and calculate scores
      const validEmails = emailDetails
        .filter((email): email is any => email !== null)
        .map(email => ({
          ...email,
          score: calculateUrgencyScore(email),
        }));
      
      // Apply filters
      let filteredEmails = validEmails;
      
      // Status filter
      if (status === 'unread') {
        filteredEmails = filteredEmails.filter(e => !e.isRead);
      } else if (status === 'backlog') {
        filteredEmails = filteredEmails.filter(e => !e.isRead && e.urgency === 'normal');
      }
      
      // Urgency filter
      if (urgency !== 'all') {
        filteredEmails = filteredEmails.filter(e => e.urgency === urgency);
      }
      
      // Sort by score descending
      filteredEmails.sort((a, b) => b.score - a.score);
      
      // Calculate stats
      const unreadCount = filteredEmails.filter(e => !e.isRead).length;
      const urgentCount = filteredEmails.filter(e => e.urgency === 'urgent').length;
      
      console.log(`[Tool: viewEmails] Found ${filteredEmails.length} emails`);
      
      // Return pure data
      return {
        success: true,
        emails: filteredEmails.map(email => ({
          id: email.id,
          from: email.from.name || email.from.email,
          fromEmail: email.from.email,
          subject: email.subject,
          snippet: email.bodyPreview,
          receivedAt: new Date(email.receivedAt),
          isRead: email.isRead,
          hasAttachments: false, // TODO: implement attachment detection
          urgency: email.urgency,
          status: email.isRead ? 'read' : 'unread',
        })),
        stats: {
          total: filteredEmails.length,
          unread: unreadCount,
          urgent: urgentCount,
        },
      };
      
    },
  })
);

const parameters = z.object({
  maxResults: z.number().optional().default(20).describe("Maximum number of emails to return"),
  query: z.string().optional().describe("Search query (e.g., 'from:sarah', 'subject:report')"),
  status: z.enum(['unread', 'backlog', 'all']).optional().default('unread'),
  urgency: z.enum(['urgent', 'important', 'normal', 'all']).optional().default('all'),
});