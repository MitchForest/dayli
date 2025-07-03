import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type ProcessEmailResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

export const processEmail = registerTool(
  createTool<typeof parameters, ProcessEmailResponse>({
    name: 'email_processEmail',
    description: "Process an email - convert to task, draft reply, or send response",
    parameters: z.object({
      emailId: z.string().describe("Gmail message ID"),
      action: z.enum(['convert_to_task', 'draft_reply', 'send_reply']).describe("Action to take"),
      taskTitle: z.string().optional().describe("For convert_to_task: Override auto-generated title"),
      schedule: z.enum(['today', 'tomorrow', 'next_week', 'backlog']).optional().default('today').describe("For convert_to_task: When to schedule"),
      replyContent: z.string().optional().describe("For draft/send: Reply content"),
    }),
    metadata: {
      category: 'email',
      displayName: 'Process Email',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ emailId, action, taskTitle, schedule, replyContent }) => {
      const gmailService = ServiceFactory.getInstance().getGmailService();
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Read email content
      const email = await gmailService.getMessage(emailId);
      
      if (!email) {
        return {
          success: false,
          error: 'Email not found',
          emailId,
          action: action === 'draft_reply' ? 'draft' : action === 'send_reply' ? 'send' : 'convert_to_task',
          result: {},
        };
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
          
          console.log(`[Tool: processEmail] Converted email ${emailId} to task ${task.id}`);
          
          return {
            success: true,
            emailId,
            action: 'convert_to_task' as const,
            result: {
              taskId: task.id,
              taskTitle: task.title,
            },
          };
        }
        
        case 'draft_reply': {
          if (!replyContent) {
            return {
              success: false,
              error: 'Reply content is required for drafting',
              emailId,
              action: 'draft' as const,
              result: {},
            };
          }
          
          // Create draft
          const draft = await gmailService.createDraft({
            to: [from], // Reply to the sender
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            body: replyContent,
            threadId: email.threadId,
          });
          
          console.log(`[Tool: processEmail] Created draft reply for email ${emailId}`);
          
          return {
            success: true,
            emailId,
            action: 'draft' as const,
            result: {
              draftId: draft,
              draftContent: replyContent,
            },
          };
        }
        
        case 'send_reply': {
          if (!replyContent) {
            return {
              success: false,
              error: 'Reply content is required for sending',
              emailId,
              action: 'send' as const,
              result: {},
            };
          }
          
          // Send the email
          const result = await gmailService.sendMessage({
            to: from,
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            body: replyContent,
            threadId: email.threadId,
          });
          
          console.log(`[Tool: processEmail] Sent reply for email ${emailId}`);
          
          return {
            success: true,
            emailId,
            action: 'send' as const,
            result: {
              draftId: result.id,
            },
          };
        }
        
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
            emailId,
            action: 'convert_to_task' as const,
            result: {},
          };
      }
    },
  })
);

const parameters = z.object({
  emailId: z.string().describe("Gmail message ID"),
  action: z.enum(['convert_to_task', 'draft_reply', 'send_reply']).describe("Action to take"),
  taskTitle: z.string().optional().describe("For convert_to_task: Override auto-generated title"),
  schedule: z.enum(['today', 'tomorrow', 'next_week', 'backlog']).optional().default('today').describe("For convert_to_task: When to schedule"),
  replyContent: z.string().optional().describe("For draft/send: Reply content"),
});