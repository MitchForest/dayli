import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type EmailToTask, type Email } from '../../schemas/email.schema';
import { buildToolResponse, buildErrorResponse, buildToolConfirmation } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { proposalStore } from '../../utils/proposal-store';

export const processEmail = tool({
  description: "Process an email - convert to task, draft reply, or send response",
  parameters: z.object({
    emailId: z.string().describe("Gmail message ID"),
    action: z.enum(['convert_to_task', 'draft_reply', 'send_reply']).describe("Action to take"),
    taskTitle: z.string().optional().describe("For convert_to_task: Override auto-generated title"),
    schedule: z.enum(['today', 'tomorrow', 'next_week', 'backlog']).optional().default('today').describe("For convert_to_task: When to schedule"),
    replyContent: z.string().optional().describe("For draft/send: Reply content"),
    confirmationId: z.string().optional().describe("For send_reply: Confirmation ID"),
  }),
  execute: async ({ emailId, action, taskTitle, schedule, replyContent, confirmationId }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'processEmail',
      operation: action === 'convert_to_task' ? 'create' as const : 'update' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      const gmailService = ServiceFactory.getInstance().getGmailService();
      const taskService = ServiceFactory.getInstance().getTaskService();
      const emailService = ServiceFactory.getInstance().getEmailService();
      
      // Read email content
      const email = await gmailService.getMessage(emailId);
      
      if (!email) {
        return buildErrorResponse(
          toolOptions,
          new Error(`Email with ID ${emailId} not found`),
          {
            title: 'Email not found',
            description: 'Could not find the email to process',
          }
        );
      }
      
      // Parse email details
      const headers = email.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown sender';
      const to = headers.find(h => h.name === 'To')?.value || '';
      
      switch (action) {
        case 'convert_to_task': {
          // Generate task title if not provided
          const title = taskTitle || `Follow up: ${subject}`;
          
          // Extract key details from email
          const snippet = email.snippet || '';
          const estimatedMinutes = snippet.length > 200 ? 45 : 30;
          
          // Create the task
          const task = await taskService.createTask({
            title,
            description: `From: ${from}\nSubject: ${subject}\n\n${snippet}`,
            priority: 'medium',
            estimatedMinutes,
            source: 'email',
            metadata: {
              emailId,
              from,
              subject,
            },
          });
          
          // Update email status
          await emailService.updateEmail(emailId, {
            status: 'processed',
            decision: schedule === 'backlog' ? 'later' : 'now',
          });
          
          const emailToTask: EmailToTask = {
            emailId,
            taskId: task.id,
            taskTitle: task.title,
            scheduledFor: schedule,
            originalSubject: subject,
            originalSender: from,
          };
          
          return buildToolResponse(
            toolOptions,
            emailToTask,
            {
              type: 'card',
              title: 'Email Converted to Task',
              description: `Created task: "${task.title}"`,
              priority: 'high',
              components: [
                {
                  type: 'taskCard',
                  data: {
                    id: task.id,
                    title: task.title,
                    priority: task.priority,
                    estimatedMinutes: task.estimatedMinutes,
                    status: 'backlog',
                    source: 'email',
                  },
                },
              ],
            },
            {
              notification: {
                show: true,
                type: 'success',
                message: `Task created and ${schedule === 'today' ? 'ready to schedule' : `added to ${schedule}`}`,
                duration: 4000,
              },
              suggestions: [
                schedule === 'today' ? 'Schedule this task now' : null,
                'View all tasks from emails',
                'Process more emails',
              ].filter(Boolean),
              actions: [
                {
                  id: 'schedule-task',
                  label: 'Schedule Task',
                  icon: 'calendar',
                  variant: 'primary',
                  action: {
                    type: 'message',
                    message: `Schedule the task "${task.title}"`,
                  },
                },
              ],
            }
          );
        }
        
        case 'draft_reply': {
          if (!replyContent) {
            return buildErrorResponse(
              toolOptions,
              new Error('Reply content is required for drafting'),
              {
                title: 'Missing Reply Content',
                description: 'Please provide the content for the reply',
              }
            );
          }
          
          // Create draft
          const draft = await gmailService.createDraft({
            to,
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            body: replyContent,
            threadId: email.threadId,
          });
          
          return buildToolResponse(
            toolOptions,
            {
              emailId,
              draftId: draft.id,
              subject,
              to,
            },
            {
              type: 'card',
              title: 'Draft Created',
              description: `Reply draft for "${subject}"`,
              priority: 'medium',
              components: [
                {
                  type: 'emailPreview',
                  data: {
                    id: emailId,
                    subject: `Re: ${subject}`,
                    from: 'You',
                    to,
                    snippet: replyContent.substring(0, 100) + '...',
                    date: new Date(),
                    isRead: true,
                    urgency: 'normal',
                  },
                },
              ],
            },
            {
              notification: {
                show: true,
                type: 'success',
                message: 'Draft saved',
                duration: 3000,
              },
              suggestions: ['Send the draft', 'Edit in Gmail', 'Create another draft'],
              actions: [
                {
                  id: 'send-draft',
                  label: 'Send Draft',
                  icon: 'send',
                  variant: 'primary',
                  action: {
                    type: 'message',
                    message: 'Send the draft reply',
                  },
                },
              ],
            }
          );
        }
        
        case 'send_reply': {
          if (!replyContent) {
            return buildErrorResponse(
              toolOptions,
              new Error('Reply content is required for sending'),
              {
                title: 'Missing Reply Content',
                description: 'Please provide the content for the reply',
              }
            );
          }
          
          // If no confirmation, create proposal
          if (!confirmationId) {
            const proposalId = proposalStore.createConfirmation(
              async () => {
                // Send the email
                return await gmailService.sendEmail({
                  to,
                  subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
                  body: replyContent,
                  threadId: email.threadId,
                });
              },
              `Send reply to "${subject}"`
            );
            
            return buildToolConfirmation(
              {
                emailId,
                to,
                subject: `Re: ${subject}`,
                replyContent,
              },
              proposalId,
              `Send reply to ${from}?`
            );
          }
          
          // Execute the send
          const proposal = proposalStore.get(confirmationId);
          if (!proposal) {
            return buildErrorResponse(
              toolOptions,
              new Error('Confirmation expired or invalid'),
              {
                title: 'Confirmation Required',
                description: 'Please confirm sending the email again',
              }
            );
          }
          
          const result = await proposal.execute();
          proposalStore.delete(confirmationId);
          
          // Update email status
          await emailService.updateEmail(emailId, {
            status: 'processed',
            decision: 'now',
          });
          
          return buildToolResponse(
            toolOptions,
            {
              emailId,
              messageId: result.id,
              threadId: result.threadId,
            },
            {
              type: 'card',
              title: 'Reply Sent',
              description: `Replied to "${subject}"`,
              priority: 'high',
              components: [],
            },
            {
              notification: {
                show: true,
                type: 'success',
                message: 'Email sent successfully',
                duration: 4000,
              },
              suggestions: ['Archive the email', 'Process next email', 'View sent items'],
              actions: [],
            }
          );
        }
        
        default:
          return buildErrorResponse(
            toolOptions,
            new Error(`Unknown action: ${action}`),
            {
              title: 'Invalid Action',
              description: 'Please specify a valid action',
            }
          );
      }
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to process email',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
});