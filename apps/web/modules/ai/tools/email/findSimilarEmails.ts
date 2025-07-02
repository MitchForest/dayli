import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';

interface SimilarEmail {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  receivedAt: string;
  snippet: string;
  similarity: {
    score: number;
    reasons: string[];
  };
}

export const findSimilarEmails = tool({
  description: 'Find emails similar to a reference email for batch processing',
  parameters: z.object({
    referenceEmailId: z.string().describe('ID of the reference email'),
    searchScope: z.enum(['subject', 'sender', 'content', 'all']).default('all'),
    maxResults: z.number().optional().default(20),
  }),
  execute: async ({ referenceEmailId, searchScope, maxResults }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'findSimilarEmails',
      operation: 'read' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // Get reference email
      const referenceEmail = await gmailService.getMessage(referenceEmailId);
      if (!referenceEmail) {
        throw new Error('Reference email not found');
      }
      
      const headers = referenceEmail.payload?.headers || [];
      const refSubject = headers.find(h => h.name === 'Subject')?.value || '';
      const refFrom = headers.find(h => h.name === 'From')?.value || '';
      const refSnippet = referenceEmail.snippet || '';
      
      // Extract sender email
      const fromMatch = refFrom.match(/<(.+)>/);
      const refFromEmail = fromMatch ? fromMatch[1] : refFrom;
      
      // Build search queries based on scope
      const queries: string[] = [];
      
      if (searchScope === 'sender' || searchScope === 'all') {
        queries.push(`from:${refFromEmail}`);
      }
      
      if (searchScope === 'subject' || searchScope === 'all') {
        // Extract key words from subject
        const subjectWords = refSubject
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3 && !['the', 'and', 'for', 'with', 'from', 'about'].includes(w))
          .slice(0, 3);
        
        if (subjectWords.length > 0) {
          queries.push(`subject:(${subjectWords.join(' OR ')})`);
        }
      }
      
      if (searchScope === 'content' || searchScope === 'all') {
        // Extract key phrases from snippet
        const contentWords = refSnippet
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 3);
        
        if (contentWords.length > 0) {
          queries.push(contentWords.join(' '));
        }
      }
      
      // Search for similar emails
      const searchQuery = queries.join(' OR ');
      const result = await gmailService.listMessages({
        q: searchQuery,
        maxResults: maxResults + 1, // +1 to exclude reference email
      });
      
      if (!result.messages || result.messages.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            referenceEmail: {
              id: referenceEmailId,
              subject: refSubject,
              from: refFrom,
            },
            similarEmails: [],
          },
          {
            type: 'card',
            title: 'No Similar Emails Found',
            description: 'No emails matching the reference criteria',
            priority: 'low',
            components: [],
          },
          {
            suggestions: ['Try a different search scope', 'Adjust search criteria'],
          }
        );
      }
      
      // Fetch details and calculate similarity
      const similarEmails: SimilarEmail[] = [];
      
      for (const msg of result.messages) {
        if (msg.id === referenceEmailId) continue; // Skip reference email
        
        const email = await gmailService.getMessage(msg.id);
        if (!email) continue;
        
        const emailHeaders = email.payload?.headers || [];
        const subject = emailHeaders.find(h => h.name === 'Subject')?.value || '';
        const from = emailHeaders.find(h => h.name === 'From')?.value || '';
        const date = emailHeaders.find(h => h.name === 'Date')?.value || '';
        const snippet = email.snippet || '';
        
        const fromEmailMatch = from.match(/<(.+)>/);
        const fromEmail = fromEmailMatch ? fromEmailMatch[1] : from;
        
        // Calculate similarity
        const reasons: string[] = [];
        let score = 0;
        
        // Same sender
        if (fromEmail === refFromEmail) {
          score += 40;
          reasons.push('Same sender');
        }
        
        // Subject similarity
        const subjectSimilarity = calculateStringSimilarity(subject.toLowerCase(), refSubject.toLowerCase());
        if (subjectSimilarity > 0.5) {
          score += subjectSimilarity * 30;
          reasons.push(`Subject ${Math.round(subjectSimilarity * 100)}% similar`);
        }
        
        // Content similarity
        const contentSimilarity = calculateStringSimilarity(snippet.toLowerCase(), refSnippet.toLowerCase());
        if (contentSimilarity > 0.3) {
          score += contentSimilarity * 30;
          reasons.push(`Content ${Math.round(contentSimilarity * 100)}% similar`);
        }
        
        if (score > 20) {
          similarEmails.push({
            id: email.id,
            subject,
            from: extractName(from),
            fromEmail,
            receivedAt: date,
            snippet,
            similarity: {
              score: Math.round(score),
              reasons,
            },
          });
        }
      }
      
      // Sort by similarity score
      similarEmails.sort((a, b) => b.similarity.score - a.similarity.score);
      
      return buildToolResponse(
        toolOptions,
        {
          referenceEmail: {
            id: referenceEmailId,
            subject: refSubject,
            from: refFrom,
          },
          similarEmails: similarEmails.slice(0, maxResults),
          totalFound: similarEmails.length,
        },
        {
          type: 'list',
          title: 'Similar Emails Found',
          description: `Found ${similarEmails.length} similar emails`,
          priority: 'medium',
          components: similarEmails.slice(0, 5).map(email => ({
            type: 'emailPreview',
            data: {
              id: email.id,
              from: email.from,
              fromEmail: email.fromEmail,
              subject: email.subject,
              preview: email.snippet,
              receivedAt: email.receivedAt,
              isRead: true,
              hasAttachments: false,
              urgency: 'normal' as const,
            },
          })),
        },
        {
          suggestions: [
            similarEmails.length > 5 ? 'Batch process similar emails' : null,
            'Create email filter',
            'Archive all similar',
            'Mark all as read',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: 'success',
            message: `Found ${similarEmails.length} similar emails`,
            duration: 3000,
          },
          actions: similarEmails.length > 0 ? [{
            id: 'batch-process',
            label: 'Batch Process All',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Process ${similarEmails.length} similar emails together`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[FIND SIMILAR EMAILS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Search Failed',
          description: 'Could not find similar emails.',
        }
      );
    }
  },
});

function extractName(fromHeader: string): string {
  const match = fromHeader.match(/^"?([^"<]+)"?\s*</);
  return match?.[1]?.trim() || fromHeader.split('@')[0] || 'Unknown';
}

function calculateStringSimilarity(str1: string, str2: string): number {
  // Simple word-based similarity
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
} 