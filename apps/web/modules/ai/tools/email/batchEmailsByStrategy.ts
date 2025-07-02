import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';

const emailInputSchema = z.object({
  id: z.string(),
  from: z.string(),
  fromEmail: z.string(),
  subject: z.string(),
  preview: z.string(),
  receivedAt: z.string(),
  urgency: z.enum(['urgent', 'important', 'normal']).optional(),
  importance: z.enum(['important', 'not_important', 'archive']).optional(),
});

const batchStrategySchema = z.enum(['importance_urgency', 'sender', 'topic', 'time_based']);

interface EmailBatch {
  type: string;
  title: string;
  description: string;
  emails: z.infer<typeof emailInputSchema>[];
  priority: 'high' | 'medium' | 'low';
  suggestedAction?: string;
}

export const batchEmailsByStrategy = tool({
  description: 'Group emails by different strategies for efficient processing',
  parameters: z.object({
    emails: z.array(emailInputSchema).describe('Array of emails to batch'),
    strategy: batchStrategySchema.describe('Batching strategy to use'),
  }),
  execute: async ({ emails, strategy }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'batchEmailsByStrategy',
      operation: 'execute' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      
      let batches: EmailBatch[] = [];
      
      switch (strategy) {
        case 'importance_urgency':
          batches = batchByImportanceUrgency(emails);
          break;
          
        case 'sender':
          batches = batchBySender(emails);
          break;
          
        case 'topic':
          batches = await batchByTopic(emails);
          break;
          
        case 'time_based':
          batches = batchByTime(emails);
          break;
      }
      
      // Sort batches by priority
      batches.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      
      return buildToolResponse(
        toolOptions,
        {
          strategy,
          batches,
          totalEmails: emails.length,
          batchCount: batches.length,
        },
        {
          type: 'list',
          title: `Email Batches (${strategy.replace('_', ' ')})`,
          description: `Grouped ${emails.length} emails into ${batches.length} batches`,
          priority: 'medium',
          components: batches.slice(0, 3).map(batch => ({
            type: 'emailPreview' as const,
            data: {
              id: `batch_${batch.type}`,
              from: `${batch.emails.length} senders`,
              fromEmail: 'batch@system',
              subject: batch.title,
              preview: batch.description,
              receivedAt: new Date().toISOString(),
              isRead: false,
              hasAttachments: false,
              urgency: batch.priority === 'high' ? 'urgent' : 
                       batch.priority === 'medium' ? 'important' : 'normal',
            },
          })),
        },
        {
          suggestions: [
            'Process high priority batch',
            'Archive low priority emails',
            'Set up filters',
          ],
          notification: {
            show: true,
            type: 'success',
            message: `Created ${batches.length} email batches`,
            duration: 3000,
          },
        }
      );
      
    } catch (error) {
      console.error('[BATCH EMAILS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Batching Failed',
          description: 'Could not batch emails. Please try again.',
        }
      );
    }
  },
});

function batchByImportanceUrgency(emails: z.infer<typeof emailInputSchema>[]): EmailBatch[] {
  const batches: EmailBatch[] = [
    {
      type: 'important_urgent',
      title: 'Important & Urgent',
      description: 'Requires immediate attention',
      emails: [],
      priority: 'high',
      suggestedAction: 'Respond within 1 hour',
    },
    {
      type: 'important_not_urgent',
      title: 'Important but Not Urgent',
      description: 'Schedule time to address',
      emails: [],
      priority: 'medium',
      suggestedAction: 'Schedule for focused work',
    },
    {
      type: 'not_important_urgent',
      title: 'Urgent but Not Important',
      description: 'Delegate or quick response',
      emails: [],
      priority: 'medium',
      suggestedAction: 'Delegate or template response',
    },
    {
      type: 'not_important_not_urgent',
      title: 'Neither Important nor Urgent',
      description: 'Archive or batch process',
      emails: [],
      priority: 'low',
      suggestedAction: 'Batch archive',
    },
  ];
  
  emails.forEach(email => {
    const isImportant = email.importance === 'important' || 
                       email.urgency === 'important';
    const isUrgent = email.urgency === 'urgent';
    
    if (isImportant && isUrgent) {
      batches[0]?.emails.push(email);
    } else if (isImportant && !isUrgent) {
      batches[1]?.emails.push(email);
    } else if (!isImportant && isUrgent) {
      batches[2]?.emails.push(email);
    } else {
      batches[3]?.emails.push(email);
    }
  });
  
  // Remove empty batches
  return batches.filter(batch => batch.emails.length > 0);
}

function batchBySender(emails: z.infer<typeof emailInputSchema>[]): EmailBatch[] {
  const senderMap = new Map<string, z.infer<typeof emailInputSchema>[]>();
  
  emails.forEach(email => {
    const key = email.fromEmail.toLowerCase();
    if (!senderMap.has(key)) {
      senderMap.set(key, []);
    }
    senderMap.get(key)!.push(email);
  });
  
  // Convert to batches, sorted by email count
  const batches: EmailBatch[] = Array.from(senderMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([sender, senderEmails]) => ({
      type: `sender_${sender}`,
      title: senderEmails[0]?.from || 'Unknown',
      description: `${senderEmails.length} emails from ${sender}`,
      emails: senderEmails,
      priority: senderEmails.length > 3 ? 'high' : 'medium',
      suggestedAction: senderEmails.length > 5 ? 'Consider unsubscribing' : 'Review together',
    }));
  
  return batches;
}

async function batchByTopic(emails: z.infer<typeof emailInputSchema>[]): Promise<EmailBatch[]> {
  // Simple keyword-based topic detection
  const topics = {
    meetings: ['meeting', 'calendar', 'schedule', 'appointment', 'call'],
    projects: ['project', 'deadline', 'milestone', 'deliverable', 'update'],
    reports: ['report', 'analysis', 'metrics', 'data', 'summary'],
    requests: ['request', 'please', 'could you', 'need', 'help'],
    newsletters: ['newsletter', 'digest', 'weekly', 'monthly', 'subscribe'],
  };
  
  const topicBatches: Map<string, z.infer<typeof emailInputSchema>[]> = new Map();
  const uncategorized: z.infer<typeof emailInputSchema>[] = [];
  
  emails.forEach(email => {
    const content = `${email.subject} ${email.preview}`.toLowerCase();
    let categorized = false;
    
    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        if (!topicBatches.has(topic)) {
          topicBatches.set(topic, []);
        }
        topicBatches.get(topic)!.push(email);
        categorized = true;
        break;
      }
    }
    
    if (!categorized) {
      uncategorized.push(email);
    }
  });
  
  const batches: EmailBatch[] = Array.from(topicBatches.entries()).map(([topic, topicEmails]) => ({
    type: `topic_${topic}`,
    title: topic.charAt(0).toUpperCase() + topic.slice(1),
    description: `${topicEmails.length} ${topic}-related emails`,
    emails: topicEmails,
    priority: topic === 'meetings' || topic === 'requests' ? 'high' : 'medium',
    suggestedAction: topic === 'newsletters' ? 'Batch unsubscribe' : `Process all ${topic}`,
  }));
  
  if (uncategorized.length > 0) {
    batches.push({
      type: 'topic_other',
      title: 'Other',
      description: `${uncategorized.length} uncategorized emails`,
      emails: uncategorized,
      priority: 'low',
      suggestedAction: 'Review individually',
    });
  }
  
  return batches;
}

function batchByTime(emails: z.infer<typeof emailInputSchema>[]): EmailBatch[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() - 7);
  
  const batches: EmailBatch[] = [
    {
      type: 'time_today',
      title: 'Today',
      description: 'Emails from today',
      emails: [],
      priority: 'high',
      suggestedAction: 'Process first',
    },
    {
      type: 'time_yesterday',
      title: 'Yesterday',
      description: 'Emails from yesterday',
      emails: [],
      priority: 'medium',
      suggestedAction: 'Quick review',
    },
    {
      type: 'time_this_week',
      title: 'This Week',
      description: 'Emails from the past week',
      emails: [],
      priority: 'medium',
      suggestedAction: 'Batch process',
    },
    {
      type: 'time_older',
      title: 'Older',
      description: 'Emails older than a week',
      emails: [],
      priority: 'low',
      suggestedAction: 'Consider archiving',
    },
  ];
  
  emails.forEach(email => {
    const emailDate = new Date(email.receivedAt);
    
    if (emailDate >= today) {
      batches[0]?.emails.push(email);
    } else if (emailDate >= yesterday) {
      batches[1]?.emails.push(email);
    } else if (emailDate >= thisWeek) {
      batches[2]?.emails.push(email);
    } else {
      batches[3]?.emails.push(email);
    }
  });
  
  // Remove empty batches
  return batches.filter(batch => batch.emails.length > 0);
} 