import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type Email } from '../../schemas/email.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

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
function determineUrgency(subject: string, body: string): 'urgent' | 'important' | 'normal' {
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical', 'deadline today'];
  const importantKeywords = ['important', 'priority', 'action required', 'please review'];
  
  const lowerSubject = subject.toLowerCase();
  const lowerBody = body.toLowerCase().substring(0, 500); // Check first 500 chars
  
  if (urgentKeywords.some(k => lowerSubject.includes(k) || lowerBody.includes(k))) {
    return 'urgent';
  }
  if (importantKeywords.some(k => lowerSubject.includes(k) || lowerBody.includes(k))) {
    return 'important';
  }
  return 'normal';
}

export const readEmailContent = tool({
  description: "Read the full content of an email including body and attachments",
  parameters: z.object({
    emailId: z.string().describe("Gmail message ID"),
    includeAttachments: z.boolean().default(false),
  }),
  execute: async ({ emailId, includeAttachments }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'readEmailContent',
      operation: 'read' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // Get the full email message
      const fullMessage = await gmailService.getMessage(emailId);
      
      if (!fullMessage) {
        return buildErrorResponse(
          toolOptions,
          new Error(`Email with ID ${emailId} not found`),
          {
            title: 'Email not found',
            description: `Could not find email with ID ${emailId}`,
          }
        );
      }
      
      // Extract body content
      let bodyPlain = '';
      let bodyHtml = '';
      
      if (fullMessage.payload?.parts) {
        // Multipart message
        for (const part of fullMessage.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyPlain = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }
      } else if (fullMessage.payload?.body?.data) {
        // Single part message
        bodyPlain = Buffer.from(fullMessage.payload.body.data, 'base64').toString('utf-8');
      }
      
      // If no plain text, convert HTML
      if (!bodyPlain && bodyHtml) {
        bodyPlain = bodyHtml.replace(/<[^>]*>/g, '').trim();
      }
      
      // Extract headers
      const headers = fullMessage.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const fromHeader = headers.find(h => h.name === 'From')?.value || '';
      const toHeader = headers.find(h => h.name === 'To')?.value || '';
      const ccHeader = headers.find(h => h.name === 'Cc')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      // Parse addresses
      const from = parseEmailAddress(fromHeader);
      const to = toHeader ? toHeader.split(',').map(addr => parseEmailAddress(addr.trim())) : [];
      const cc = ccHeader ? ccHeader.split(',').map(addr => parseEmailAddress(addr.trim())) : undefined;
      
      // Extract attachments if requested
      const attachments = [];
      if (includeAttachments && fullMessage.payload?.parts) {
        for (const part of fullMessage.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            attachments.push({
              id: part.body.attachmentId,
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              size: part.body.size || 0,
            });
          }
        }
      }
      
      // Extract action items using simple pattern matching
      const actionItems = extractActionItems(bodyPlain);
      
      // Determine urgency
      const urgency = determineUrgency(subject, bodyPlain);
      
      const email: Email = {
        id: emailId,
        threadId: fullMessage.threadId || emailId,
        subject,
        from,
        to,
        cc,
        bodyPreview: fullMessage.snippet || bodyPlain.substring(0, 200).trim(),
        bodyHtml: bodyHtml || undefined,
        bodyPlain,
        attachments: attachments.length > 0 ? attachments : undefined,
        actionItems: actionItems.length > 0 ? actionItems : undefined,
        receivedAt: new Date(date).toISOString(),
        isRead: fullMessage.labelIds?.includes('UNREAD') === false,
        isStarred: fullMessage.labelIds?.includes('STARRED') || false,
        labels: fullMessage.labelIds || [],
        urgency,
      };
      
      return buildToolResponse(
        toolOptions,
        email,
        {
          type: 'card',
          title: subject || '(No subject)',
          description: `From: ${from.name || from.email}`,
          priority: urgency === 'urgent' ? 'high' : urgency === 'important' ? 'medium' : 'low',
          components: [
            {
              type: 'emailPreview',
              data: {
                id: email.id,
                from: email.from.name,
                fromEmail: email.from.email,
                subject: email.subject,
                preview: email.bodyPreview,
                receivedAt: email.receivedAt,
                isRead: email.isRead,
                hasAttachments: attachments.length > 0,
                urgency: email.urgency,
              },
            },
          ],
        },
        {
          suggestions: actionItems.length > 0 
            ? ['Create tasks from action items', 'Draft a response', 'Archive this email']
            : ['Draft a response', 'Archive this email', 'Forward to team'],
          actions: [
            {
              id: 'draft-response',
              label: 'Draft Response',
              icon: 'reply',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'draftEmailResponse',
                params: { 
                  emailId,
                  to: [from.email],
                  subject: `Re: ${subject}`,
                },
              },
            },
            ...(actionItems.length > 0 ? [{
              id: 'create-tasks',
              label: 'Create Tasks',
              icon: 'tasks',
              variant: 'secondary' as const,
              action: {
                type: 'tool' as const,
                tool: 'processEmailToTask',
                params: { emailId },
              },
            }] : []),
            {
              id: 'archive',
              label: 'Archive',
              icon: 'archive',
              variant: 'secondary',
              action: {
                type: 'message' as const,
                message: `Archive email ${emailId}`,
              },
            },
          ],
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to read email',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
});

// Helper function to extract action items from email body
function extractActionItems(body: string): string[] {
  const actionItems: string[] = [];
  
  // Common action patterns
  const patterns = [
    /(?:please|could you|can you|would you|need to|should|must)\s+([^.!?]+)/gi,
    /(?:action item|todo|task):\s*([^.!?\n]+)/gi,
    /(?:by|before|until)\s+(\d{1,2}\/\d{1,2}|\w+ \d{1,2})/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = body.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 10 && match[1].length < 100) {
        actionItems.push(match[1].trim());
      }
    }
  }
  
  // Deduplicate
  return [...new Set(actionItems)].slice(0, 5); // Max 5 action items
} 