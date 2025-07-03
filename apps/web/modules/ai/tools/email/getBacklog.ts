import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type GetEmailBacklogResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  status: z.array(z.enum(['unread', 'backlog'])).optional().default(['unread', 'backlog']).describe('Email statuses to include'),
  limit: z.number().min(1).max(100).optional().default(50).describe('Maximum number of emails to return'),
});

// Helper function
function checkForAttachments(message: any): boolean {
  if (!message?.payload) return false;
  
  const checkParts = (parts: any[]): boolean => {
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        return true;
      }
      if (part.parts) {
        if (checkParts(part.parts)) return true;
      }
    }
    return false;
  };
  
  if (message.payload.parts) {
    return checkParts(message.payload.parts);
  }
  
  return false;
}

export const getBacklog = registerTool(
  createTool<typeof parameters, GetEmailBacklogResponse>({
    name: 'email_getBacklog',
    description: 'Get unread and backlog emails',
    parameters,
    metadata: {
      category: 'email',
      displayName: 'Get Email Backlog',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ status, limit }) => {
      try {
        const emailService = ServiceFactory.getInstance().getGmailService();
        
        // Get emails based on status
        const allEmails = [];
        
        for (const emailStatus of status) {
          const query = emailStatus === 'unread' ? 'is:unread' : 'label:backlog';
          const emails = await emailService.listMessages({
            q: query,
            maxResults: limit,
          });
          
          if (emails.messages) {
            for (const message of emails.messages) {
              // Get full message details
              const fullMessage = await emailService.getMessage(message.id);
              
              if (!fullMessage) {
                console.warn(`[Tool: getBacklog] Could not get details for message ${message.id}`);
                continue;
              }
              
              // Extract key information
              const headers = fullMessage.payload?.headers || [];
              const fromHeader = headers.find(h => h.name === 'From');
              const subjectHeader = headers.find(h => h.name === 'Subject');
              const dateHeader = headers.find(h => h.name === 'Date');
              
              allEmails.push({
                id: fullMessage.id,
                from: fromHeader?.value || 'Unknown',
                subject: subjectHeader?.value || 'No Subject',
                snippet: fullMessage.snippet || '',
                receivedAt: dateHeader?.value || new Date().toISOString(),
                status: emailStatus,
                hasAttachments: checkForAttachments(fullMessage),
                threadId: fullMessage.threadId || fullMessage.id,
                labelIds: fullMessage.labelIds || [],
              });
            }
          }
        }
        
        // Sort by date (newest first)
        allEmails.sort((a, b) => {
          const dateA = new Date(a.receivedAt).getTime();
          const dateB = new Date(b.receivedAt).getTime();
          return dateB - dateA;
        });
        
        // Limit total results
        const limitedEmails = allEmails.slice(0, limit);
        
        console.log(`[Tool: getBacklog] Found ${limitedEmails.length} emails (${status.join(', ')})`);
        
        return {
          success: true,
          emails: limitedEmails,
          total: limitedEmails.length,
          hasMore: allEmails.length > limit,
        };
        
      } catch (error) {
        console.error('[Tool: getBacklog] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get email backlog',
          emails: [],
          total: 0,
          hasMore: false,
        };
      }
    },
  })
); 