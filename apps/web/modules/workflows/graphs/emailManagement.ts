/*
import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import { ServiceFactory } from '@/services/factory/service.factory';
import {
  listEmails,
  analyzeSingleEmail,
  batchEmailsByStrategy,
  updateEmailBacklog,
  getEmailBacklogSummary,
  analyzeSenderPatterns,
  createTimeBlock
} from "@/modules/ai/tools";
import { getCurrentUserId } from '@/modules/ai/tools/utils/helpers';
import { format } from 'date-fns';
import {
  determineEmailAction,
  calculateResponseTime,
  calculateDuration
} from '../utils/scheduleHelpers';
import type {
  EmailState,
  EmailData,
  Change,
  Insight,
  AnalyzedEmail,
  EmailBatch,
  EmailPattern
} from '../types/domain-workflow.types';

const WORKFLOW_NAME = 'emailManagement';

export function createEmailManagementWorkflow() {
  const workflow = new StateGraph<EmailState>({
    channels: {
      userId: null,
      intent: null,
      ragContext: null,
      data: {
        emails: [],
        backlogEmails: [],
        analyzedEmails: [],
        emailBatches: [],
        patterns: [],
      },
      proposedChanges: [],
      messages: [],
    },
  });

  // Add all nodes
  workflow.addNode("fetchEmails", fetchEmailsNode);
  workflow.addNode("fetchRAGContext", fetchRAGContextNode);
  workflow.addNode("analyzeEmails", analyzeEmailsNode);
  workflow.addNode("detectPatterns", detectPatternsNode);
  workflow.addNode("batchEmails", batchEmailsNode);
  workflow.addNode("createEmailBlocks", createEmailBlocksNode);
  workflow.addNode("updateBacklog", updateBacklogNode);
  workflow.addNode("generateSummary", generateSummaryNode);

  // Define flow
  workflow.setEntryPoint("fetchEmails");
  workflow.addEdge("fetchEmails", "fetchRAGContext");
  workflow.addEdge("fetchRAGContext", "analyzeEmails");
  workflow.addEdge("analyzeEmails", "detectPatterns");
  workflow.addEdge("detectPatterns", "batchEmails");
  workflow.addEdge("batchEmails", "createEmailBlocks");
  workflow.addEdge("createEmailBlocks", "updateBacklog");
  workflow.addEdge("updateBacklog", "generateSummary");
  workflow.addEdge("generateSummary", END);

  return workflow.compile();
}

// Fetch new and backlog emails
async function fetchEmailsNode(state: EmailState): Promise<Partial<EmailState>> {
  try {
    // Fetch new emails and backlog in parallel
    const [newEmailsResult, backlogResult] = await Promise.all([
      listEmails.execute({ maxResults: 50 }),
      getEmailBacklogSummary.execute({})
    ]);

    const newEmails = newEmailsResult.data?.emails || [];
    const backlogSummary = backlogResult.data || { emails: [] };

    return {
      data: {
        ...state.data,
        emails: newEmails,
        backlogEmails: backlogSummary.emails || [],
      },
      messages: [
        ...state.messages,
        new AIMessage(`Fetched ${newEmails.length} new emails and ${backlogSummary.totalCount || 0} backlog emails`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in fetchEmails:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error fetching emails: ${error instanceof Error ? error.message : 'Unknown error'}`)
      ]
    };
  }
}

// Fetch RAG context for sender patterns
async function fetchRAGContextNode(state: EmailState): Promise<Partial<EmailState>> {
  try {
    // For now, return empty RAG context (Sprint 03.04)
    return {
      ragContext: {
        patterns: [],
        recentDecisions: [],
        similarDays: [],
      }
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in fetchRAGContext:`, error);
    return state;
  }
}

// Analyze emails for importance and urgency
async function analyzeEmailsNode(state: EmailState): Promise<Partial<EmailState>> {
  try {
    const allEmails = [...state.data.emails, ...state.data.backlogEmails];
    const analyzedEmails: AnalyzedEmail[] = [];
    
    // Analyze emails in batches for performance
    const batchSize = 10;
    for (let i = 0; i < allEmails.length; i += batchSize) {
      const batch = allEmails.slice(i, i + batchSize);
      
      const analyses = await Promise.all(
        batch.map(async (email) => {
          try {
            // Check sender patterns from RAG
            const senderPattern = state.ragContext?.patterns?.find(p => 
              p.type === 'sender' && p.metadata?.email === email.from
            );
            
            if (senderPattern) {
              // Use historical pattern
              return {
                id: email.id,
                from: email.from,
                subject: email.subject,
                importance: senderPattern.metadata?.importance || "not_important",
                urgency: senderPattern.metadata?.typicalUrgency || "can_wait",
                estimatedResponseTime: senderPattern.metadata?.avgResponseTime || 30,
                suggestedAction: determineEmailAction(
                  senderPattern.metadata?.importance || "not_important",
                  senderPattern.metadata?.typicalUrgency || "can_wait"
                ),
              } as AnalyzedEmail;
            } else {
              // Analyze with AI
              const result = await analyzeSingleEmail.execute({
                from: email.from,
                fromEmail: email.fromEmail || email.from,
                subject: email.subject,
                content: email.snippet || email.preview || '',
                receivedAt: email.receivedAt || new Date().toISOString()
              });
              
              if (result.data?.analysis) {
                const analysis = result.data.analysis;
                return {
                  id: email.id,
                  from: email.from,
                  subject: email.subject,
                  importance: analysis.importance,
                  urgency: analysis.urgency,
                  estimatedResponseTime: analysis.estimatedResponseTime,
                  suggestedAction: analysis.suggestedAction,
                } as AnalyzedEmail;
              }
            }
            
            // Fallback
            return {
              id: email.id,
              from: email.from,
              subject: email.subject,
              importance: "not_important" as const,
              urgency: "can_wait" as const,
              estimatedResponseTime: 30,
              suggestedAction: "review_later",
            } as AnalyzedEmail;
          } catch (error) {
            console.error(`Error analyzing email ${email.id}:`, error);
            return null;
          }
        })
      );
      
      analyzedEmails.push(...analyses.filter((a): a is AnalyzedEmail => a !== null));
    }
    
    return {
      data: {
        ...state.data,
        analyzedEmails,
      },
      messages: [
        ...state.messages,
        new AIMessage(`Analyzed ${analyzedEmails.length} emails for importance and urgency`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in analyzeEmails:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error analyzing emails: ${error instanceof Error ? error.message : 'Unknown error'}`)
      ]
    };
  }
}

// Detect sender patterns and topics
async function detectPatternsNode(state: EmailState): Promise<Partial<EmailState>> {
  try {
    const patterns: EmailPattern[] = [];
    
    // Group emails by sender
    const senderGroups = new Map<string, AnalyzedEmail[]>();
    state.data.analyzedEmails.forEach(email => {
      const sender = email.from;
      if (!senderGroups.has(sender)) {
        senderGroups.set(sender, []);
      }
      senderGroups.get(sender)!.push(email);
    });
    
    // Analyze patterns for frequent senders
    for (const [sender, emails] of senderGroups.entries()) {
      if (emails.length >= 3) {
        // Use the analyzeSenderPatterns tool
        const result = await analyzeSenderPatterns.execute({
          senderEmail: sender,
          timeframe: 'week'
        });
        
        if (result.data) {
          patterns.push({
            sender,
            frequency: result.data.emailCount || emails.length,
            averageImportance: result.data.importanceDistribution?.important > 0.5 ? 'important' : 'not_important',
            typicalResponseTime: result.data.averageResponseTime || 30,
          });
        } else {
          // Calculate from current batch
          const importantCount = emails.filter(e => e.importance === 'important').length;
          const avgResponseTime = emails.reduce((sum, e) => sum + e.estimatedResponseTime, 0) / emails.length;
          
          patterns.push({
            sender,
            frequency: emails.length,
            averageImportance: importantCount > emails.length / 2 ? 'important' : 'not_important',
            typicalResponseTime: Math.round(avgResponseTime),
          });
        }
      }
    }
    
    return {
      data: {
        ...state.data,
        patterns,
      },
      messages: [
        ...state.messages,
        new AIMessage(`Detected ${patterns.length} sender patterns`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in detectPatterns:`, error);
    return state;
  }
}

// Batch emails for efficient processing
async function batchEmailsNode(state: EmailState): Promise<Partial<EmailState>> {
  try {
    // Determine batching strategy based on email volume
    const totalEmails = state.data.analyzedEmails.length;
    let strategy: 'urgency' | 'sender' | 'topic' | 'time';
    
    if (totalEmails < 20) {
      strategy = 'urgency';
    } else if (state.data.patterns.length > 5) {
      strategy = 'sender';
    } else {
      strategy = 'topic';
    }
    
    // Use the batchEmailsByStrategy tool
    const result = await batchEmailsByStrategy.execute({
      emails: state.data.analyzedEmails.map(e => ({
        id: e.id,
        from: e.from,
        subject: e.subject,
        urgency: e.urgency,
        importance: e.importance,
      })),
      strategy,
      maxBatchSize: 10,
    });
    
    const emailBatches: EmailBatch[] = [];
    
    if (result.data?.batches) {
      result.data.batches.forEach((batch, index) => {
        emailBatches.push({
          id: `batch-${index}`,
          strategy,
          emails: batch.emails.map(e => e.id),
          estimatedTime: batch.estimatedMinutes,
          reason: batch.reason,
        });
      });
    }
    
    return {
      data: {
        ...state.data,
        emailBatches,
      },
      messages: [
        ...state.messages,
        new AIMessage(`Created ${emailBatches.length} email batches using ${strategy} strategy`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in batchEmails:`, error);
    return state;
  }
}

// Create time blocks for email processing
async function createEmailBlocksNode(state: EmailState): Promise<Partial<EmailState>> {
  try {
    const proposedChanges: Change[] = [];
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Calculate total email processing time needed
    const totalMinutesNeeded = state.data.emailBatches.reduce((sum, batch) => sum + batch.estimatedTime, 0);
    
    // Determine how many email blocks to create
    if (totalMinutesNeeded > 0) {
      if (totalMinutesNeeded <= 30) {
        // Single morning email block
        proposedChanges.push({
          type: "create",
          entity: "block",
          data: {
            type: "email",
            title: "Email Processing",
            startTime: "09:00",
            endTime: "09:30",
            date: today,
            metadata: {
              batchIds: state.data.emailBatches.map(b => b.id),
              emailCount: state.data.analyzedEmails.length,
            }
          },
          reason: `Process ${state.data.analyzedEmails.length} emails in one focused session`,
        });
      } else if (totalMinutesNeeded <= 60) {
        // Morning and afternoon blocks
        proposedChanges.push({
          type: "create",
          entity: "block",
          data: {
            type: "email",
            title: "Morning Email Triage",
            startTime: "09:00",
            endTime: "09:30",
            date: today,
            metadata: {
              batchIds: state.data.emailBatches.slice(0, Math.ceil(state.data.emailBatches.length / 2)).map(b => b.id),
            }
          },
          reason: "Handle urgent emails in the morning",
        });
        
        proposedChanges.push({
          type: "create",
          entity: "block",
          data: {
            type: "email",
            title: "Afternoon Email Processing",
            startTime: "16:00",
            endTime: "16:30",
            date: today,
            metadata: {
              batchIds: state.data.emailBatches.slice(Math.ceil(state.data.emailBatches.length / 2)).map(b => b.id),
            }
          },
          reason: "Process remaining emails before end of day",
        });
      } else {
        // Multiple blocks throughout the day
        const blocksNeeded = Math.ceil(totalMinutesNeeded / 30);
        const times = ["09:00", "11:30", "14:00", "16:00"];
        
        for (let i = 0; i < Math.min(blocksNeeded, times.length); i++) {
          proposedChanges.push({
            type: "create",
            entity: "block",
            data: {
              type: "email",
              title: `Email Batch ${i + 1}`,
              startTime: times[i],
              endTime: format(new Date(`2000-01-01T${times[i]}`).getTime() + 30 * 60 * 1000, 'HH:mm'),
              date: today,
              metadata: {
                batchId: state.data.emailBatches[i]?.id,
              }
            },
            reason: `Distributed email processing to avoid overwhelm`,
          });
        }
      }
    }
    
    return {
      proposedChanges: [...state.proposedChanges, ...proposedChanges]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in createEmailBlocks:`, error);
    return state;
  }
}

// Update email backlog with aging
async function updateBacklogNode(state: EmailState): Promise<Partial<EmailState>> {
  try {
    // Determine which emails to add to backlog
    const emailsToBacklog = state.data.analyzedEmails.filter(email => 
      email.urgency === 'can_wait' && email.importance === 'not_important'
    );
    
    if (emailsToBacklog.length > 0) {
      // Update backlog
      const result = await updateEmailBacklog.execute({
        action: 'add',
        emails: emailsToBacklog.map(email => ({
          id: email.id,
          urgency: email.urgency,
          importance: email.importance,
          metadata: {
            from: email.from,
            subject: email.subject,
            estimatedResponseTime: email.estimatedResponseTime,
          }
        }))
      });
      
      if (result.data) {
        return {
          messages: [
            ...state.messages,
            new AIMessage(`Added ${emailsToBacklog.length} low-priority emails to backlog`)
          ]
        };
      }
    }
    
    // Also check for stale emails in backlog
    const backlogSummary = await getEmailBacklogSummary.execute({});
    if (backlogSummary.data?.staleEmails && backlogSummary.data.staleEmails.length > 0) {
      return {
        messages: [
          ...state.messages,
          new AIMessage(`Warning: ${backlogSummary.data.staleEmails.length} emails in backlog are over 7 days old`)
        ]
      };
    }
    
    return state;
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in updateBacklog:`, error);
    return state;
  }
}

// Generate summary of email triage decisions
async function generateSummaryNode(state: EmailState): Promise<Partial<EmailState>> {
  try {
    const summary = generateEmailSummary(state);
    
    // Generate insights
    const insights: Insight[] = [];
    
    // Urgency distribution insight
    const urgentCount = state.data.analyzedEmails.filter(e => e.urgency === 'urgent').length;
    const importantCount = state.data.analyzedEmails.filter(e => e.importance === 'important').length;
    
    if (urgentCount > state.data.analyzedEmails.length * 0.3) {
      insights.push({
        type: "warning",
        message: `${urgentCount} urgent emails need immediate attention`,
        severity: "high"
      });
    }
    
    if (importantCount > state.data.analyzedEmails.length * 0.5) {
      insights.push({
        type: "observation",
        message: `High proportion of important emails (${importantCount}/${state.data.analyzedEmails.length})`,
        severity: "medium"
      });
    }
    
    // Pattern insights
    state.data.patterns.forEach(pattern => {
      if (pattern.frequency > 5 && pattern.averageImportance === 'important') {
        insights.push({
          type: "recommendation",
          message: `${pattern.sender} sends frequent important emails - consider priority inbox rule`,
          severity: "low"
        });
      }
    });
    
    // Time management insight
    const totalProcessingTime = state.data.emailBatches.reduce((sum, batch) => sum + batch.estimatedTime, 0);
    if (totalProcessingTime > 90) {
      insights.push({
        type: "warning",
        message: `Email processing will take ${Math.round(totalProcessingTime / 60)} hours - consider delegating or using templates`,
        severity: "medium"
      });
    }
    
    // Next steps
    const nextSteps: string[] = [];
    if (state.proposedChanges.length > 0) {
      nextSteps.push("Review and confirm email processing time blocks");
    }
    if (urgentCount > 0) {
      nextSteps.push(`Process ${urgentCount} urgent emails first`);
    }
    if (state.data.patterns.length > 0) {
      nextSteps.push("Set up email filters based on detected patterns");
    }
    
    return {
      messages: [
        ...state.messages,
        new AIMessage(summary)
      ],
      data: {
        ...state.data,
        summary,
      }
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in generateSummary:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage("Email triage complete")
      ]
    };
  }
}

// Helper function to generate summary
function generateEmailSummary(state: EmailState): string {
  const parts: string[] = [];
  
  parts.push(`Analyzed ${state.data.analyzedEmails.length} emails`);
  
  const urgentCount = state.data.analyzedEmails.filter(e => e.urgency === 'urgent').length;
  const importantCount = state.data.analyzedEmails.filter(e => e.importance === 'important').length;
  
  if (urgentCount > 0) {
    parts.push(`${urgentCount} urgent`);
  }
  if (importantCount > 0) {
    parts.push(`${importantCount} important`);
  }
  
  if (state.data.emailBatches.length > 0) {
    parts.push(`organized into ${state.data.emailBatches.length} batches`);
  }
  
  if (state.proposedChanges.length > 0) {
    parts.push(`${state.proposedChanges.length} time blocks proposed`);
  }
  
  return parts.join(', ') + '.';
}
*/ 