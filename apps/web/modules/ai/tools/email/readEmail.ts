import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ReadEmailResponse } from '../types/responses';
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

export const readEmail = registerTool(
  createTool<typeof parameters, ReadEmailResponse>({
    name: 'email_readEmail',
    description: "Read the full content of an email with urgency analysis",
    parameters: z.object({
      emailId: z.string().describe("Gmail message ID"),
      includeAttachments: z.boolean().default(false),
    }),
    metadata: {
      category: 'email',
      displayName: 'Read Email',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ emailId, includeAttachments }) => {
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // Get the full email message
      const fullMessage = await gmailService.getMessage(emailId);
      
      if (!fullMessage) {
        return {
          success: false,
          error: `Email with ID ${emailId} not found`,
          email: {
            id: emailId,
            from: '',
            fromEmail: '',
            to: '',
            subject: '',
            body: '',
            receivedAt: new Date().toISOString(),
          },
        };
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
      
      console.log(`[Tool: readEmail] Read email ${emailId} with urgency: ${urgency}`);
      
      // Return pure data
      return {
        success: true,
        email: {
          id: emailId,
          threadId: fullMessage.threadId || emailId,
          subject,
          from: from.name || from.email,
          fromEmail: from.email,
          to: to.map(t => t.email).join(', '),
          body: bodyPlain,
          receivedAt: new Date(date).toISOString(),
          attachments: attachments.length > 0 ? attachments.map(a => ({
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
          })) : undefined,
          extractedActions: actionItems.length > 0 ? actionItems : undefined,
        },
      };
      
    },
  })
);

const parameters = z.object({
  emailId: z.string().describe("Gmail message ID"),
  includeAttachments: z.boolean().default(false),
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