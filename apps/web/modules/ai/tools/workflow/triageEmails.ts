import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type TriageEmailsResponse } from '../types/responses';
import { getCurrentUserId, storeProposedChanges } from '../utils/helpers';
import { generateText, generateObject, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  includeBacklog: z.boolean().default(true),
  maxMinutes: z.number().optional().describe("Maximum processing time in minutes"),
});

export const triageEmails = registerTool(
  createTool<typeof parameters, TriageEmailsResponse>({
    name: 'workflow_triageEmails',
    description: "Analyze and batch emails for efficient processing",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Triage Emails',
      requiresConfirmation: true,
      supportsStreaming: true,
    },
    execute: async ({ includeBacklog, maxMinutes }) => {
      try {
        // Step 1: Analyze email situation
        const { object: analysis } = await generateObject({
          model: openai('gpt-4o'),
          schema: z.object({
            totalUnread: z.number(),
            hasUrgentSenders: z.boolean(),
            hasActionableEmails: z.boolean(),
            suggestedBatchSize: z.number(),
            strategy: z.enum(['quick-triage', 'deep-process', 'defer-all'])
          }),
          prompt: 'Analyze the email backlog and determine triage strategy.'
        });
        
        // Step 2: Define sub-tools
        const fetchEmails = tool({
          description: 'Fetch emails for triage',
          parameters: z.object({
            includeBacklog: z.boolean()
          }),
          execute: async ({ includeBacklog }) => {
            const factory = ServiceFactory.getInstance();
            const gmailService = factory.getGmailService();
            
            // Get emails
            const { messages } = await gmailService.listMessages({
              maxResults: 50,
              q: includeBacklog ? 'is:unread' : 'is:unread newer_than:1d'
            });
            
            // Only fetch full details for unread emails
            const unreadEmails = messages.filter(m => {
              // Since listMessages doesn't return labelIds, we'll need to fetch details
              // For now, assume all are unread and fetch details in batches
              return true; // Will be filtered after fetching details
            });
            
            // Fetch details for first batch
            const emailDetails = await Promise.all(
              unreadEmails.slice(0, 10).map(m => gmailService.getMessage(m.id))
            );
            
            const validEmails = emailDetails.filter(e => e && !e.labelIds.includes('TRASH'));
            
            return {
              emails: validEmails,
              totalUnread: validEmails.length,
              hasMore: unreadEmails.length > 10
            };
          }
        });
        
        const analyzeEmails = tool({
          description: 'Analyze emails using importance/urgency matrix',
          parameters: z.object({
            emails: z.array(z.any())
          }),
          execute: async ({ emails }) => {
            // Get sender patterns for better scoring
            const senderPatterns = await analyzeSenderPatterns(emails);
            
            // Score each email with sophisticated analysis
            const scoredEmails = emails.map((email: any) => {
              const subject = email.payload.headers.find((h: any) => h.name === 'Subject')?.value || '';
              const from = email.payload.headers.find((h: any) => h.name === 'From')?.value || '';
              const fromEmail = extractEmailAddress(from);
              const receivedDate = new Date(parseInt(email.internalDate));
              const ageHours = (Date.now() - receivedDate.getTime()) / (1000 * 60 * 60);
              
              // Sophisticated importance scoring (0-100)
              let importance = 30; // Base importance
              
              // Sender importance
              const senderPattern = senderPatterns.get(fromEmail);
              if (senderPattern) {
                importance += senderPattern.averageImportance * 30;
                if (senderPattern.isVIP) importance += 20;
                if (senderPattern.responseRate > 0.8) importance += 10;
              }
              
              // Leadership/VIP detection
              const vipIndicators = ['ceo', 'cto', 'cfo', 'president', 'director', 'manager', 'boss'];
              if (vipIndicators.some(vip => from.toLowerCase().includes(vip))) {
                importance += 25;
              }
              
              // Content importance
              const importantKeywords = ['contract', 'proposal', 'invoice', 'payment', 'deadline', 
                                       'urgent', 'important', 'critical', 'meeting', 'review'];
              const importanceMatches = importantKeywords.filter(k => 
                subject.toLowerCase().includes(k)
              ).length;
              importance += Math.min(importanceMatches * 10, 30);
              
              // Thread importance (replies are often important)
              if (subject.toLowerCase().startsWith('re:')) importance += 10;
              
              // Sophisticated urgency scoring (0-100)
              let urgency = 20; // Base urgency
              
              // Time-based urgency
              if (ageHours < 2) urgency += 30;
              else if (ageHours < 6) urgency += 20;
              else if (ageHours < 24) urgency += 10;
              else if (ageHours > 72) urgency -= 10;
              
              // Keyword urgency
              const urgentKeywords = ['today', 'eod', 'asap', 'urgent', 'immediately', 
                                     'now', 'deadline', 'expires', 'by end of'];
              const urgencyMatches = urgentKeywords.filter(k => 
                subject.toLowerCase().includes(k) || 
                getEmailSnippet(email).toLowerCase().includes(k)
              ).length;
              urgency += Math.min(urgencyMatches * 15, 40);
              
              // Calendar-based urgency
              if (subject.toLowerCase().includes('meeting') && 
                  (subject.toLowerCase().includes('today') || 
                   subject.toLowerCase().includes('tomorrow'))) {
                urgency += 20;
              }
              
              // Cap scores at 100
              importance = Math.min(importance, 100);
              urgency = Math.min(urgency, 100);
              
              // Calculate quadrant with thresholds
              const quadrant = getQuadrant(importance, urgency);
              
              return {
                ...email,
                importance,
                urgency,
                quadrant,
                fromEmail,
                senderPattern,
                ageHours,
                estimatedMinutes: quadrant === 'do-first' ? 5 : 
                                 quadrant === 'schedule' ? 3 : 
                                 quadrant === 'delegate' ? 2 : 1,
                suggestedAction: getActionForQuadrant(quadrant, importance, urgency)
              };
            });
            
            // Group by sender for batching
            const bySender = new Map<string, any[]>();
            scoredEmails.forEach(email => {
              if (!bySender.has(email.fromEmail)) {
                bySender.set(email.fromEmail, []);
              }
              bySender.get(email.fromEmail)!.push(email);
            });
            
            return {
              scoredEmails,
              byQuadrant: {
                doFirst: scoredEmails.filter((e: any) => e.quadrant === 'do-first'),
                schedule: scoredEmails.filter((e: any) => e.quadrant === 'schedule'),
                delegate: scoredEmails.filter((e: any) => e.quadrant === 'delegate'),
                defer: scoredEmails.filter((e: any) => e.quadrant === 'defer')
              },
              bySender: Object.fromEntries(bySender),
              senderCount: bySender.size
            };
          }
        });
        
        const createActionPlan = tool({
          description: 'Create batched action plan',
          parameters: z.object({
            emailsByQuadrant: z.any(),
            bySender: z.any(),
            maxMinutes: z.number().optional()
          }),
          execute: async ({ emailsByQuadrant, bySender, maxMinutes }) => {
            const batches: Array<{
              id: string;
              category: string;
              emails: any[];
              estimatedMinutes: number;
              priority: string;
              strategy: string;
              senderGroups?: number;
              sender?: string;
              deferred?: boolean;
            }> = [];
            const suggestedActions = [];
            
            // Smart batching threshold
            const URGENT_BATCH_THRESHOLD = 5;
            
            // Batch 1: Do First (immediate action) - only if threshold met
            if (emailsByQuadrant.doFirst.length >= URGENT_BATCH_THRESHOLD) {
              // Group urgent emails by sender for efficiency
              const urgentBySender = groupBySender(emailsByQuadrant.doFirst);
              
              batches.push({
                id: 'batch-urgent',
                category: 'Urgent & Important',
                emails: emailsByQuadrant.doFirst.slice(0, 10).map((e: any) => ({
                  id: e.id,
                  subject: e.payload.headers.find((h: any) => h.name === 'Subject')?.value || '',
                  from: e.payload.headers.find((h: any) => h.name === 'From')?.value || '',
                  suggestedAction: e.suggestedAction
                })),
                estimatedMinutes: Math.min(emailsByQuadrant.doFirst.length * 5, 30),
                priority: 'high',
                strategy: 'Process immediately - group responses by sender',
                senderGroups: urgentBySender.size
              });
              
              suggestedActions.push({
                type: 'draft',
                count: emailsByQuadrant.doFirst.length,
                emails: emailsByQuadrant.doFirst.map((e: any) => e.id)
              });
            }
            
            // Batch 2: Schedule (important but not urgent)
            if (emailsByQuadrant.schedule.length > 0) {
              batches.push({
                id: 'batch-important',
                category: 'Important Not Urgent',
                emails: emailsByQuadrant.schedule.map((e: any) => ({
                  id: e.id,
                  subject: e.payload.headers.find((h: any) => h.name === 'Subject')?.value || '',
                  from: e.payload.headers.find((h: any) => h.name === 'From')?.value || '',
                  suggestedAction: e.suggestedAction
                })),
                estimatedMinutes: emailsByQuadrant.schedule.length * 3,
                priority: 'medium',
                strategy: 'Schedule for tomorrow morning focus time'
              });
              
              suggestedActions.push({
                type: 'convert_to_task',
                count: emailsByQuadrant.schedule.length,
                emails: emailsByQuadrant.schedule.map((e: any) => e.id)
              });
            }
            
            // Batch 3: Sender-based batching for delegate quadrant
            const delegateBySender = groupBySender(emailsByQuadrant.delegate);
            delegateBySender.forEach((emails, sender) => {
              if (emails.length >= 2) { // Only batch if 2+ emails from same sender
                batches.push({
                  id: `batch-sender-${sender.substring(0, 8)}`,
                  category: 'Quick Replies',
                  emails: emails.map((e: any) => ({
                    id: e.id,
                    subject: e.payload.headers.find((h: any) => h.name === 'Subject')?.value || '',
                    from: e.payload.headers.find((h: any) => h.name === 'From')?.value || '',
                    suggestedAction: 'Batch reply'
                  })),
                  estimatedMinutes: emails.length * 2,
                  priority: 'low',
                  strategy: `Batch reply to ${emails.length} emails from ${sender}`,
                  sender
                });
              }
            });
            
            // Batch 4: Bulk archive (defer quadrant)
            const archiveCandidates = emailsByQuadrant.defer.filter((e: any) => 
              e.ageHours > 48 || e.importance < 30
            );
            
            if (archiveCandidates.length > 0) {
              batches.push({
                id: 'batch-archive',
                category: 'Low Priority - Archive',
                emails: archiveCandidates.map((e: any) => ({
                  id: e.id,
                  subject: e.payload.headers.find((h: any) => h.name === 'Subject')?.value || '',
                  from: e.payload.headers.find((h: any) => h.name === 'From')?.value || '',
                  suggestedAction: 'Archive'
                })),
                estimatedMinutes: 1,
                priority: 'none',
                strategy: 'Bulk archive low-priority emails'
              });
              
              suggestedActions.push({
                type: 'archive',
                count: archiveCandidates.length,
                emails: archiveCandidates.map((e: any) => e.id)
              });
            }
            
            // Time-boxed processing
            if (maxMinutes) {
              let timeUsed = 0;
              batches.forEach(batch => {
                if (timeUsed + batch.estimatedMinutes <= maxMinutes) {
                  timeUsed += batch.estimatedMinutes;
                } else {
                  batch.deferred = true;
                  batch.strategy += ' (DEFERRED - exceeds time budget)';
                }
              });
            }
            
            return {
              emailBatches: batches.filter(b => !b.deferred),
              suggestedActions,
              totalProcessingTime: batches.filter(b => !b.deferred)
                .reduce((sum, b) => sum + b.estimatedMinutes, 0)
            };
          }
        });
        
        // Only include tools we need based on analysis
        const finalizeEmailPlan = tool({
          description: 'Finalize email triage plan',
          parameters: z.object({
            emailBatches: z.array(z.any()),
            suggestedActions: z.array(z.any())
          }),
          execute: async ({ emailBatches, suggestedActions }) => {
            return {
              emailBatches,
              suggestedActions
            };
          }
        });
        
        // Execute workflow
        const tools: any = {
          fetchEmails,
          ...(analysis.hasActionableEmails && { analyzeEmails }),
          ...(analysis.strategy !== 'defer-all' && { createActionPlan }),
          finalizeEmailPlan
        };
        
        const { toolCalls } = await generateText({
          model: openai('gpt-4o'),
          tools,
          maxSteps: 4,
          system: `You are an AI assistant helping triage emails efficiently.
          
Context from analysis:
- Total unread: ${analysis.totalUnread}
- Has urgent senders: ${analysis.hasUrgentSenders}
- Strategy: ${analysis.strategy}
- Time budget: ${maxMinutes || 'unlimited'} minutes

Your task:
1. Fetch emails (include backlog: ${includeBacklog})
2. ${analysis.hasActionableEmails ? 'Analyze emails using importance/urgency matrix' : 'Skip analysis for low-priority emails'}
3. ${analysis.strategy !== 'defer-all' ? 'Create batched action plan' : 'Defer all to later'}
4. Finalize the triage plan

Use the 2x2 importance/urgency matrix to prioritize.`,
          prompt: `Triage emails${maxMinutes ? ` within ${maxMinutes} minutes` : ''}.`,
          onStepFinish: ({ toolCalls }) => {
            if (toolCalls && toolCalls.length > 0) {
              console.log(`[triageEmails] Step completed: ${toolCalls[0]?.toolName}`);
            }
          }
        });
        
        // Extract final plan
        const finalAnswer = toolCalls?.find(tc => tc && tc.toolName === 'finalizeEmailPlan');
        if (!finalAnswer) {
          throw new Error('Workflow did not produce a final email plan');
        }
        
        const plan = finalAnswer.args as any;
        
        // Generate proposal ID if there are actions
        const proposalId = plan.suggestedActions.length > 0 
          ? crypto.randomUUID()
          : undefined;
          
        if (proposalId) {
          await storeProposedChanges(proposalId, plan.suggestedActions);
        }
        
        return {
          success: true,
          emailBatches: plan.emailBatches,
          suggestedActions: plan.suggestedActions,
          proposalId
        };
      } catch (error) {
        console.error('[Workflow: triageEmails] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to triage emails',
          emailBatches: [],
          suggestedActions: []
        };
      }
    },
  })
);

// Helper functions for sophisticated email analysis
function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<(.+)>/);
  return match ? match[1] : fromHeader;
}

async function analyzeSenderPatterns(emails: any[]): Promise<Map<string, any>> {
  const patterns = new Map();
  
  // Group emails by sender
  const bySender = new Map<string, any[]>();
  emails.forEach(email => {
    const from = email.payload.headers.find((h: any) => h.name === 'From')?.value || '';
    const fromEmail = extractEmailAddress(from);
    
    if (!bySender.has(fromEmail)) {
      bySender.set(fromEmail, []);
    }
    bySender.get(fromEmail)!.push(email);
  });
  
  // Analyze patterns for each sender
  bySender.forEach((senderEmails, sender) => {
    const pattern = {
      sender,
      emailCount: senderEmails.length,
      averageImportance: 0.5,
      isVIP: false,
      responseRate: 0.5,
      typicalSubjects: []
    };
    
    // VIP detection
    const vipDomains = ['company.com', 'client.com', 'partner.com'];
    if (vipDomains.some(domain => sender.includes(domain))) {
      pattern.isVIP = true;
      pattern.averageImportance = 0.8;
    }
    
    // High volume sender = likely less important
    if (senderEmails.length > 5) {
      pattern.averageImportance *= 0.7;
    }
    
    patterns.set(sender, pattern);
  });
  
  return patterns;
}

function getEmailSnippet(email: any): string {
  return email.snippet || '';
}

function getQuadrant(importance: number, urgency: number): string {
  // Thresholds for quadrant classification
  const IMPORTANCE_THRESHOLD = 60;
  const URGENCY_THRESHOLD = 60;
  
  if (importance >= IMPORTANCE_THRESHOLD && urgency >= URGENCY_THRESHOLD) {
    return 'do-first';
  } else if (importance >= IMPORTANCE_THRESHOLD && urgency < URGENCY_THRESHOLD) {
    return 'schedule';
  } else if (importance < IMPORTANCE_THRESHOLD && urgency >= URGENCY_THRESHOLD) {
    return 'delegate';
  } else {
    return 'defer';
  }
}

function getActionForQuadrant(quadrant: string, importance: number, urgency: number): string {
  switch (quadrant) {
    case 'do-first':
      if (urgency > 80) return 'Respond immediately - highly urgent';
      return 'Respond within 2 hours';
      
    case 'schedule':
      if (importance > 80) return 'Schedule for deep work session';
      return 'Add to tomorrow\'s focus time';
      
    case 'delegate':
      if (urgency > 80) return 'Quick template reply';
      return 'Delegate or batch reply';
      
    case 'defer':
      if (importance < 20) return 'Archive immediately';
      return 'Review next week';
      
    default:
      return 'Process as time permits';
  }
}

function groupBySender(emails: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  
  emails.forEach(email => {
    const sender = email.fromEmail || 'unknown';
    if (!grouped.has(sender)) {
      grouped.set(sender, []);
    }
    grouped.get(sender)!.push(email);
  });
  
  return grouped;
} 