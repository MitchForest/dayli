import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type EmailToTask, type Email } from '../../schemas/email.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
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
            description: `From: ${from}\nSubject: ${subject}\n\n${snippet}\n\nEmail ID: ${emailId}`,
            priority: 'medium',
            estimatedMinutes,
            source: 'email',
          });
          
          // Update email status via Gmail service
          // Note: Gmail service doesn't have updateEmail method, so we'll skip this for now
          // TODO: Add email status tracking in a future sprint
          
          // Extract from and to from headers
          const fromHeader = email.payload?.headers?.find(h => h.name.toLowerCase() === 'from');
          const toHeader = email.payload?.headers?.find(h => h.name.toLowerCase() === 'to');
          
          const emailToTask: EmailToTask = {
            emailId,
            email: {
              id: emailId,
              threadId: email.threadId || '',
              from: { name: '', email: fromHeader?.value || from },
              to: toHeader?.value ? [{ email: toHeader.value }] : [],
              subject,
              bodyPreview: snippet,
              bodyPlain: email.snippet || '',
              receivedAt: new Date().toISOString(),
              isRead: true,
              urgency: 'normal',
            },
            suggestedTask: {
              title: task.title,
              description: task.description || '',
              priority: task.priority,
              estimatedMinutes: task.estimatedMinutes,
            },
            createdTaskId: task.id,
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
              ].filter(Boolean) as string[],
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
            to: [from], // Reply to the sender
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            body: replyContent,
            threadId: email.threadId,
          });
          
          return buildToolResponse(
            toolOptions,
            {
              emailId,
              draftId: draft,
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
                    from: 'You',
                    fromEmail: 'me',
                    subject: `Re: ${subject}`,
                    preview: replyContent.substring(0, 100) + '...',
                    receivedAt: new Date().toISOString(),
                    isRead: true,
                    hasAttachments: false,
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
            const proposalId = proposalStore.store(
              'send_reply',
              `Send reply to ${from}`,
              {
                tool: 'processEmail',
                action: 'send_reply',
                params: {
                  emailId,
                  to: from, // Reply to sender
                  subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
                  body: replyContent,
                  threadId: email.threadId,
                }
              }
            );
            
            return buildToolResponse(
              toolOptions,
              {
                proposalId,
                requiresConfirmation: true,
                emailId,
                to: from,
                subject: `Re: ${subject}`,
                preview: replyContent.substring(0, 100) + '...',
              },
              {
                type: 'confirmation',
                title: 'Confirm Email Send',
                description: `Ready to send reply to ${from}`,
                priority: 'high',
                components: [{
                  type: 'emailPreview',
                  data: {
                    id: proposalId,
                    from: 'You',
                    fromEmail: 'me',
                    subject: `Re: ${subject}`,
                    preview: replyContent.substring(0, 100) + '...',
                    receivedAt: new Date().toISOString(),
                    isRead: true,
                    hasAttachments: false,
                    urgency: 'normal',
                  },
                }],
              },
              {
                confirmationRequired: true,
                confirmationId: proposalId,
                actions: [{
                  id: 'send',
                  label: 'Send Email',
                  icon: 'send',
                  variant: 'primary',
                  action: {
                    type: 'tool',
                    tool: 'processEmail',
                    params: {
                      emailId,
                      action: 'send_reply',
                      confirmationId: proposalId,
                    },
                  },
                }],
              }
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
          
          // Send the email using stored params
          const params = proposal.data?.params;
          if (!params) {
            throw new Error('Invalid proposal data');
          }
          
          const result = await gmailService.sendMessage({
            to: params.to,
            subject: params.subject,
            body: params.body,
            threadId: params.threadId,
          });
          
          proposalStore.delete(confirmationId);
          
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