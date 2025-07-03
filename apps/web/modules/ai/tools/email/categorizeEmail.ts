import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type CategorizeEmailResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  emailId: z.string().describe('ID of the email to categorize'),
});

// Helper functions
function extractBody(email: any): string {
  if (!email?.payload) return '';
  
  // Try to get plain text body
  const extractText = (payload: any): string => {
    if (payload.body?.data) {
      try {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } catch {
        return '';
      }
    }
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain') {
          return extractText(part);
        }
      }
      // If no plain text, try HTML
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html') {
          const html = extractText(part);
          // Basic HTML stripping
          return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }
    
    return '';
  };
  
  return extractText(email.payload) || email.snippet || '';
}

function analyzeEmail(from: string, subject: string, body: string): {
  category: 'needs_reply' | 'important_info' | 'potential_task' | 'can_archive';
  confidence: number;
  suggestedAction: string;
  urgencyScore: number;
} {
  const lowerSubject = subject.toLowerCase();
  const lowerBody = body.toLowerCase();
  const lowerFrom = from.toLowerCase();
  
  // Check for reply indicators
  const replyIndicators = [
    'please reply',
    'please respond',
    'let me know',
    'your thoughts',
    'what do you think',
    'can you',
    'could you',
    'would you',
    'need your',
    'waiting for',
    'asap',
    'urgent',
    '?',
  ];
  
  const replyScore = replyIndicators.reduce((score, indicator) => {
    if (lowerSubject.includes(indicator) || lowerBody.includes(indicator)) {
      return score + 1;
    }
    return score;
  }, 0);
  
  // Check for important information
  const importantIndicators = [
    'fyi',
    'for your information',
    'announcement',
    'update',
    'notice',
    'reminder',
    'meeting notes',
    'summary',
    'report',
  ];
  
  const importantScore = importantIndicators.reduce((score, indicator) => {
    if (lowerSubject.includes(indicator) || lowerBody.includes(indicator)) {
      return score + 1;
    }
    return score;
  }, 0);
  
  // Check for task indicators
  const taskIndicators = [
    'action required',
    'todo',
    'to do',
    'task',
    'deadline',
    'due date',
    'by ',
    'complete',
    'finish',
    'submit',
  ];
  
  const taskScore = taskIndicators.reduce((score, indicator) => {
    if (lowerSubject.includes(indicator) || lowerBody.includes(indicator)) {
      return score + 1;
    }
    return score;
  }, 0);
  
  // Check for newsletter/notification indicators
  const archiveIndicators = [
    'unsubscribe',
    'newsletter',
    'notification',
    'no-reply',
    'noreply',
    'do-not-reply',
    'automated',
    'alert',
    'digest',
  ];
  
  const archiveScore = archiveIndicators.reduce((score, indicator) => {
    if (lowerFrom.includes(indicator) || lowerSubject.includes(indicator)) {
      return score + 1;
    }
    return score;
  }, 0);
  
  // Determine category based on scores
  let category: 'needs_reply' | 'important_info' | 'potential_task' | 'can_archive';
  let confidence: number;
  let suggestedAction: string;
  let urgencyScore: number;
  
  if (archiveScore >= 2) {
    category = 'can_archive';
    confidence = Math.min(archiveScore * 20, 90);
    suggestedAction = 'Archive this automated message';
    urgencyScore = 10;
  } else if (replyScore >= 2) {
    category = 'needs_reply';
    confidence = Math.min(replyScore * 15, 85);
    suggestedAction = 'Reply to this email';
    urgencyScore = replyScore >= 4 ? 90 : 70;
  } else if (taskScore >= 2) {
    category = 'potential_task';
    confidence = Math.min(taskScore * 20, 80);
    suggestedAction = 'Create a task from this email';
    urgencyScore = 60;
  } else if (importantScore >= 1) {
    category = 'important_info';
    confidence = Math.min(importantScore * 25, 75);
    suggestedAction = 'Review this information';
    urgencyScore = 40;
  } else {
    category = 'can_archive';
    confidence = 50;
    suggestedAction = 'Archive after reading';
    urgencyScore = 20;
  }
  
  // Boost urgency for certain keywords
  if (lowerSubject.includes('urgent') || lowerSubject.includes('asap')) {
    urgencyScore = Math.min(urgencyScore + 30, 100);
  }
  
  return {
    category,
    confidence,
    suggestedAction,
    urgencyScore,
  };
}

export const categorizeEmail = registerTool(
  createTool<typeof parameters, CategorizeEmailResponse>({
    name: 'email_categorizeEmail',
    description: 'Categorize a single email and suggest action',
    parameters,
    metadata: {
      category: 'email',
      displayName: 'Categorize Email',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ emailId }) => {
      try {
        const emailService = ServiceFactory.getInstance().getGmailService();
        
        // Get the email
        const email = await emailService.getMessage(emailId);
        
        if (!email) {
          return {
            success: false,
            error: 'Email not found',
            category: 'can_archive',
            confidence: 0,
            suggestedAction: 'Email not found',
            urgencyScore: 0,
          };
        }
        
        // Extract email details
        const headers = email.payload?.headers || [];
        const fromHeader = headers.find(h => h.name === 'From');
        const subjectHeader = headers.find(h => h.name === 'Subject');
        
        const from = fromHeader?.value || '';
        const subject = subjectHeader?.value || '';
        const body = extractBody(email);
        
        // Analyze email content
        const analysis = analyzeEmail(from, subject, body);
        
        console.log(`[Tool: categorizeEmail] Categorized as ${analysis.category} with ${analysis.confidence}% confidence`);
        
        return {
          success: true,
          category: analysis.category,
          confidence: analysis.confidence,
          suggestedAction: analysis.suggestedAction,
          urgencyScore: analysis.urgencyScore,
        };
        
      } catch (error) {
        console.error('[Tool: categorizeEmail] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to categorize email',
          category: 'can_archive',
          confidence: 0,
          suggestedAction: 'Error occurred',
          urgencyScore: 0,
        };
      }
    },
  })
); 