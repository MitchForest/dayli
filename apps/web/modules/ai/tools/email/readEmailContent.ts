import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

export const readEmailContent = tool({
  description: "Read the full content of an email including body and attachments",
  parameters: z.object({
    emailId: z.string().describe("Gmail message ID"),
    includeAttachments: z.boolean().default(false),
  }),
  execute: async ({ emailId, includeAttachments }) => {
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // Get the full email message
      const email = await gmailService.getMessage(emailId);
      
      if (!email) {
        return toolError(
          'EMAIL_NOT_FOUND',
          `Email with ID ${emailId} not found`
        );
      }
      
      // Extract body content
      let body = '';
      if (email.payload?.parts) {
        // Multipart message
        for (const part of email.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          } else if (part.mimeType === 'text/html' && part.body?.data && !body) {
            // Fall back to HTML if no plain text
            const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
            // Simple HTML to text conversion
            body = html.replace(/<[^>]*>/g, '').trim();
          }
        }
      } else if (email.payload?.body?.data) {
        // Single part message
        body = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
      }
      
      // Extract headers
      const headers = email.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const to = headers.find(h => h.name === 'To')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      // Extract attachments if requested
      const attachments = [];
      if (includeAttachments && email.payload?.parts) {
        for (const part of email.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size,
              attachmentId: part.body.attachmentId
            });
          }
        }
      }
      
      // Extract action items using simple pattern matching
      // In a real implementation, this could use AI
      const actionItems = extractActionItems(body);
      
      const result = {
        id: emailId,
        threadId: email.threadId,
        subject,
        from,
        to,
        body,
        attachments,
        actionItems,
        receivedAt: date,
        labels: email.labelIds || []
      };
      
      return toolSuccess(result, {
        type: 'email',
        content: result
      }, {
        affectedItems: [emailId],
        suggestions: actionItems.length > 0 
          ? ['Create tasks from action items', 'Draft a response', 'Archive this email']
          : ['Draft a response', 'Archive this email', 'Forward to team']
      });
      
    } catch (error) {
      return toolError(
        'EMAIL_READ_FAILED',
        `Failed to read email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
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