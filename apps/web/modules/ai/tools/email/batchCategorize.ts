import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type BatchCategorizeResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  emailIds: z.array(z.string()).describe('Array of email IDs to categorize'),
});

// Reuse the analyzeEmail function from categorizeEmail
function analyzeEmailQuick(from: string, subject: string, snippet: string): {
  category: 'needs_reply' | 'important_info' | 'potential_task' | 'can_archive';
  urgencyScore: number;
} {
  const lowerSubject = subject.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  const lowerFrom = from.toLowerCase();
  
  // Quick scoring based on keywords
  let category: 'needs_reply' | 'important_info' | 'potential_task' | 'can_archive' = 'can_archive';
  let urgencyScore = 20;
  
  // Check for automated/newsletter emails first
  if (lowerFrom.includes('no-reply') || lowerFrom.includes('noreply') || 
      lowerFrom.includes('newsletter') || lowerSubject.includes('unsubscribe')) {
    return { category: 'can_archive', urgencyScore: 10 };
  }
  
  // Check for reply indicators
  if (lowerSubject.includes('re:') || lowerSubject.includes('?') ||
      lowerSnippet.includes('please reply') || lowerSnippet.includes('let me know') ||
      lowerSnippet.includes('your thoughts') || lowerSnippet.includes('waiting for')) {
    category = 'needs_reply';
    urgencyScore = 70;
  }
  // Check for task indicators
  else if (lowerSubject.includes('action required') || lowerSubject.includes('todo') ||
           lowerSnippet.includes('deadline') || lowerSnippet.includes('due date') ||
           lowerSnippet.includes('complete by')) {
    category = 'potential_task';
    urgencyScore = 60;
  }
  // Check for important info
  else if (lowerSubject.includes('fyi') || lowerSubject.includes('announcement') ||
           lowerSubject.includes('update') || lowerSubject.includes('reminder')) {
    category = 'important_info';
    urgencyScore = 40;
  }
  
  // Boost urgency for certain keywords
  if (lowerSubject.includes('urgent') || lowerSubject.includes('asap')) {
    urgencyScore = Math.min(urgencyScore + 30, 100);
  }
  
  return { category, urgencyScore };
}

export const batchCategorize = registerTool(
  createTool<typeof parameters, BatchCategorizeResponse>({
    name: 'email_batchCategorize',
    description: 'Categorize multiple emails efficiently in batch',
    parameters,
    metadata: {
      category: 'email',
      displayName: 'Batch Categorize Emails',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ emailIds }) => {
      try {
        const emailService = ServiceFactory.getInstance().getGmailService();
        
        const categorized: Array<{
          emailId: string;
          category: 'needs_reply' | 'important_info' | 'potential_task' | 'can_archive';
          urgencyScore: number;
        }> = [];
        
        const failed: Array<{
          emailId: string;
          reason: string;
        }> = [];
        
        // Process emails in parallel for efficiency
        const promises = emailIds.map(async (emailId) => {
          try {
            const email = await emailService.getMessage(emailId);
            
            if (!email) {
              failed.push({ emailId, reason: 'Email not found' });
              return;
            }
            
            // Extract key information
            const headers = email.payload?.headers || [];
            const fromHeader = headers.find(h => h.name === 'From');
            const subjectHeader = headers.find(h => h.name === 'Subject');
            
            const from = fromHeader?.value || '';
            const subject = subjectHeader?.value || '';
            const snippet = email.snippet || '';
            
            // Quick analysis based on headers and snippet
            const analysis = analyzeEmailQuick(from, subject, snippet);
            
            categorized.push({
              emailId,
              category: analysis.category,
              urgencyScore: analysis.urgencyScore,
            });
            
          } catch (error) {
            failed.push({
              emailId,
              reason: error instanceof Error ? error.message : 'Failed to categorize',
            });
          }
        });
        
        // Wait for all categorizations to complete
        await Promise.all(promises);
        
        // Sort by urgency score
        categorized.sort((a, b) => b.urgencyScore - a.urgencyScore);
        
        console.log(`[Tool: batchCategorize] Categorized ${categorized.length}/${emailIds.length} emails`);
        
        return {
          success: true,
          categorized,
          failed,
          totalProcessed: categorized.length,
          totalFailed: failed.length,
        };
        
      } catch (error) {
        console.error('[Tool: batchCategorize] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to batch categorize',
          categorized: [],
          failed: emailIds.map(id => ({ emailId: id, reason: 'System error' })),
          totalProcessed: 0,
          totalFailed: emailIds.length,
        };
      }
    },
  })
); 