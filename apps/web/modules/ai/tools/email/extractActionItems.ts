import { tool } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';

const actionItemSchema = z.object({
  task: z.string().describe('The action item or task'),
  owner: z.enum(['me', 'sender', 'other']).describe('Who should do this'),
  deadline: z.string().optional().describe('When this needs to be done'),
  priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
  context: z.string().describe('Additional context or requirements'),
});

const extractionResultSchema = z.object({
  actionItems: z.array(actionItemSchema),
  hasCommitments: z.boolean(),
  requiresResponse: z.boolean(),
  responseDeadline: z.string().optional(),
  summary: z.string().describe('Brief summary of what needs to be done'),
});

export const extractActionItems = tool({
  description: 'Extract tasks and action items from email content using AI',
  parameters: z.object({
    emailId: z.string().describe('Email ID for reference'),
    subject: z.string().describe('Email subject'),
    content: z.string().describe('Email body content'),
    from: z.string().describe('Sender name'),
    receivedAt: z.string().describe('When the email was received'),
  }),
  execute: async (params): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'extractActionItems',
      operation: 'execute' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      
      // Use AI to extract action items
      const extraction = await generateObject({
        model: openai('gpt-4-turbo'),
        schema: extractionResultSchema,
        prompt: `Extract all action items and tasks from this email:

From: ${params.from}
Subject: ${params.subject}
Received: ${params.receivedAt}

Content:
${params.content}

Identify:
1. Explicit tasks or requests (things asked to be done)
2. Implicit commitments (things that need follow-up)
3. Deadlines or time-sensitive items
4. Who is responsible for each item

For each action item, determine:
- The specific task
- Who should do it (me = recipient, sender = the person who sent email, other = someone else)
- Any deadline mentioned
- Priority based on urgency and importance
- Context needed to complete the task

Also indicate if the email requires a response and by when.`,
      });
      
      const result = extraction.object;
      
      return buildToolResponse(
        toolOptions,
        {
          emailId: params.emailId,
          extraction: result,
          metadata: {
            totalActionItems: result.actionItems.length,
            myActionItems: result.actionItems.filter(item => item.owner === 'me').length,
            highPriorityItems: result.actionItems.filter(item => item.priority === 'high').length,
          },
        },
        {
          type: 'list',
          title: 'Extracted Action Items',
          description: result.summary,
          priority: result.actionItems.some(item => item.priority === 'high') ? 'high' : 'medium',
          components: result.actionItems.map((item, idx) => ({
            type: 'taskCard',
            data: {
              id: `action_${params.emailId}_${idx}`,
              title: item.task,
              priority: item.priority,
              estimatedMinutes: item.priority === 'high' ? 30 : 15,
              status: 'backlog' as const,
              description: item.context,
              dueDate: item.deadline,
            },
          })),
        },
        {
          suggestions: [
            result.actionItems.length > 0 ? 'Create tasks from action items' : null,
            result.requiresResponse ? 'Draft response' : null,
            result.hasCommitments ? 'Add to calendar' : null,
            'Forward to team',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: result.actionItems.length > 0 ? 'success' : 'info',
            message: result.actionItems.length > 0 
              ? `Found ${result.actionItems.length} action items`
              : 'No action items found',
            duration: 3000,
          },
          actions: result.actionItems.length > 0 ? [{
            id: 'create-all-tasks',
            label: 'Create All Tasks',
            variant: 'primary',
            action: {
              type: 'message',
              message: `Create ${result.actionItems.length} tasks from email action items`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[EXTRACT ACTION ITEMS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Extraction Failed',
          description: 'Could not extract action items from email.',
        }
      );
    }
  },
}); 