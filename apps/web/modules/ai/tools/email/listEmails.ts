import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';

export const listEmails = tool({
  description: "List emails from inbox with basic information",
  parameters: z.object({
    maxResults: z.number().optional().default(10).describe("Maximum number of emails to return"),
    query: z.string().optional().describe("Search query (e.g., 'from:sarah', 'subject:report')"),
  }),
  execute: async ({ maxResults, query }) => {
    try {
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // List messages with optional query
      const result = await gmailService.listMessages({
        maxResults,
        q: query
      });
      
      if (!result.messages || result.messages.length === 0) {
        return toolSuccess({
          emails: [],
          count: 0,
          query
        }, {
          type: 'list',
          content: []
        }, {
          suggestions: ['Check spam folder', 'Try a different search', 'Refresh inbox']
        });
      }
      
      // Fetch details for each message
      const emailDetails = await Promise.all(
        result.messages.map(async (msg) => {
          try {
            const fullMessage = await gmailService.getMessage(msg.id);
            if (!fullMessage) return null;
            
            const headers = fullMessage.payload?.headers || [];
            const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
            const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            
            return {
              id: fullMessage.id,
              from,
              subject,
              snippet: fullMessage.snippet,
              date,
              isRead: fullMessage.labelIds?.includes('UNREAD') === false
            };
          } catch (error) {
            console.error(`Failed to fetch email ${msg.id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out nulls
      const validEmails = emailDetails.filter(email => email !== null);
      
      return toolSuccess({
        emails: validEmails,
        count: validEmails.length,
        totalEstimate: result.resultSizeEstimate,
        query
      }, {
        type: 'list',
        content: validEmails
      }, {
        suggestions: validEmails.length > 0
          ? ['Read an email', 'Draft a response', 'Archive old emails']
          : ['Check spam folder', 'Try a different search']
      });
      
    } catch (error) {
      return toolError(
        'EMAIL_LIST_FAILED',
        `Failed to list emails: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 