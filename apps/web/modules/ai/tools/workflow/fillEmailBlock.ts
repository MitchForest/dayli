import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { getCurrentUserId } from '../utils/helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { type FillEmailBlockResponse } from '../types/responses';
import { differenceInDays } from 'date-fns';

const parameters = z.object({
  blockId: z.string().describe("ID of the email block to fill"),
  blockDuration: z.number().describe("Minutes available in the block")
});

export const fillEmailBlock = registerTool(
  createTool<typeof parameters, FillEmailBlockResponse>({
    name: 'workflow_fillEmailBlock',
    description: "Determine which emails to process during an email block - identifies urgent emails and batches by sender",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Fill Email Block',
      requiresConfirmation: false,
      supportsStreaming: true,
    },
    execute: async ({ blockId, blockDuration }) => {
      try {
        const userId = await getCurrentUserId();
        
        // In production, we'd query the emails table directly
        // For now, simulate intelligent email triage
        const emails = await getEmailsForTriage(userId);
        
        // Categorize emails
        const categorizedEmails = emails.map(email => {
          const category = categorizeEmail(email);
          const score = calculateEmailScore(email, category);
          return { ...email, category, score };
        });
        
        // Sort by score (highest priority first)
        categorizedEmails.sort((a, b) => b.score - a.score);
        
        // Build response categories
        const needsReply: Array<{
          id: string;
          from: string;
          subject: string;
          reason: string;
          actionType: 'quick_reply' | 'thoughtful_response';
          daysInBacklog: number;
        }> = [];
        
        const importantInfo: Array<{
          id: string;
          from: string;
          subject: string;
          reason: string;
        }> = [];
        
        const suggestedArchive: Array<{
          id: string;
          from: string;
          subject: string;
          reason: string;
        }> = [];
        
        const convertToTask: Array<{
          id: string;
          from: string;
          subject: string;
          suggestedTaskTitle: string;
        }> = [];
        
        // Process emails based on category and available time
        let estimatedMinutesUsed = 0;
        
        for (const email of categorizedEmails) {
          // Skip if we're out of time
          if (estimatedMinutesUsed >= blockDuration) break;
          
          switch (email.category) {
            case 'needs_reply':
              if (needsReply.length < 10) { // Max 10 reply emails per block
                const isQuickReply = email.subject.toLowerCase().includes('quick') || 
                                   email.subject.toLowerCase().includes('yes/no') ||
                                   email.subject.length < 50;
                
                needsReply.push({
                  id: email.id,
                  from: email.from,
                  subject: email.subject,
                  reason: email.daysInBacklog > 2 
                    ? `Waiting ${email.daysInBacklog} days for reply`
                    : email.urgency === 'urgent' 
                      ? 'Urgent response needed'
                      : 'Requires response',
                  actionType: isQuickReply ? 'quick_reply' : 'thoughtful_response',
                  daysInBacklog: email.daysInBacklog
                });
                estimatedMinutesUsed += isQuickReply ? 2 : 10;
              }
              break;
              
            case 'important_info':
              if (importantInfo.length < 5) { // Max 5 FYI emails
                importantInfo.push({
                  id: email.id,
                  from: email.from,
                  subject: email.subject,
                  reason: email.importance === 'high' 
                    ? 'Important information'
                    : 'FYI - may be relevant'
                });
                estimatedMinutesUsed += 2;
              }
              break;
              
            case 'potential_task':
              if (convertToTask.length < 3) { // Max 3 task conversions
                convertToTask.push({
                  id: email.id,
                  from: email.from,
                  subject: email.subject,
                  suggestedTaskTitle: extractTaskTitle(email)
                });
                estimatedMinutesUsed += 3;
              }
              break;
              
            case 'can_archive':
              suggestedArchive.push({
                id: email.id,
                from: email.from,
                subject: email.subject,
                reason: email.isNewsletter 
                  ? 'Newsletter/Promotional'
                  : email.isNotification
                    ? 'Automated notification'
                    : 'No action required'
              });
              break;
          }
        }
        
        // Group emails by sender for batch processing
        const batchedBySender = groupEmailsBySender(needsReply);
        
        return {
          success: true,
          blockId,
          urgent: needsReply.filter(e => e.daysInBacklog > 3 || e.reason.includes('Urgent')),
          batched: batchedBySender,
          archived: suggestedArchive.length,
          totalToProcess: needsReply.length + importantInfo.length + convertToTask.length
        };
        
      } catch (error) {
        console.error('[Workflow: fillEmailBlock] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fill email block',
          blockId,
          urgent: [],
          batched: [],
          archived: 0,
          totalToProcess: 0
        };
      }
    },
  })
);

// Helper functions for email triage

async function getEmailsForTriage(userId: string): Promise<any[]> {
  // In production, this would query the emails table with status IN ('unread', 'backlog')
  // For now, simulate with test data
  const testEmails = [
    {
      id: '1',
      from: 'boss@company.com',
      subject: 'Urgent: Budget approval needed by EOD',
      status: 'unread',
      urgency: 'urgent',
      importance: 'high',
      daysInBacklog: 0,
      receivedAt: new Date()
    },
    {
      id: '2',
      from: 'client@example.com',
      subject: 'Re: Project timeline question',
      status: 'backlog',
      urgency: 'important',
      importance: 'high',
      daysInBacklog: 3,
      receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      id: '3',
      from: 'newsletter@techcompany.com',
      subject: 'Your weekly tech digest',
      status: 'unread',
      urgency: 'low',
      importance: 'low',
      daysInBacklog: 0,
      isNewsletter: true,
      receivedAt: new Date()
    },
    {
      id: '4',
      from: 'teammate@company.com',
      subject: 'Can you review this PR?',
      status: 'unread',
      urgency: 'normal',
      importance: 'normal',
      daysInBacklog: 1,
      receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
    },
    {
      id: '5',
      from: 'service@github.com',
      subject: 'Your CI build passed',
      status: 'unread',
      urgency: 'low',
      importance: 'low',
      daysInBacklog: 0,
      isNotification: true,
      receivedAt: new Date()
    }
  ];
  
  return testEmails;
}

function categorizeEmail(email: any): 'needs_reply' | 'important_info' | 'potential_task' | 'can_archive' {
  const subjectLower = email.subject.toLowerCase();
  const fromLower = email.from.toLowerCase();
  
  // Check if it's a newsletter or notification
  if (email.isNewsletter || email.isNotification || 
      fromLower.includes('noreply') || fromLower.includes('no-reply')) {
    return 'can_archive';
  }
  
  // Check if it needs a reply
  if (subjectLower.includes('?') || 
      subjectLower.includes('please') ||
      subjectLower.includes('can you') ||
      subjectLower.includes('re:') ||
      email.status === 'backlog') {
    return 'needs_reply';
  }
  
  // Check if it's a potential task
  if (subjectLower.includes('action required') ||
      subjectLower.includes('todo') ||
      subjectLower.includes('task') ||
      subjectLower.includes('assignment')) {
    return 'potential_task';
  }
  
  // Default to important info
  return 'important_info';
}

function calculateEmailScore(email: any, category: string): number {
  let score = 0;
  
  // Base score by category
  switch (category) {
    case 'needs_reply':
      score = 70;
      break;
    case 'important_info':
      score = 50;
      break;
    case 'potential_task':
      score = 60;
      break;
    case 'can_archive':
      score = 10;
      break;
  }
  
  // Urgency modifier
  if (email.urgency === 'urgent') score += 30;
  else if (email.urgency === 'important') score += 20;
  
  // Age modifier - older emails get higher priority
  score += Math.min(email.daysInBacklog * 10, 30);
  
  // VIP sender modifier
  if (email.from.includes('boss') || email.from.includes('ceo') || email.from.includes('manager')) {
    score += 20;
  }
  
  return Math.min(score, 100);
}

function extractTaskTitle(email: any): string {
  // Extract a task title from the email subject
  const subject = email.subject;
  
  // Remove common prefixes
  let taskTitle = subject
    .replace(/^(Re:|Fwd:|FW:)\s*/gi, '')
    .replace(/^(Action Required:|Todo:|Task:)\s*/gi, '');
  
  // Truncate if too long
  if (taskTitle.length > 50) {
    taskTitle = taskTitle.substring(0, 47) + '...';
  }
  
  return taskTitle;
}

function groupEmailsBySender(emails: any[]): Array<{
  sender: string;
  count: number;
  emails: Array<{ id: string; subject: string }>;
}> {
  const senderMap = new Map<string, any[]>();
  
  // Group emails by sender
  emails.forEach(email => {
    if (!senderMap.has(email.from)) {
      senderMap.set(email.from, []);
    }
    senderMap.get(email.from)!.push({
      id: email.id,
      subject: email.subject
    });
  });
  
  // Convert to array and filter for batches
  return Array.from(senderMap.entries())
    .filter(([_, emails]) => emails.length >= 2)
    .map(([sender, emails]) => ({
      sender,
      count: emails.length,
      emails: emails.slice(0, 5) // Max 5 per batch
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Max 5 batches
} 