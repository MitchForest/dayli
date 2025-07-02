import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type EmailToTask } from '../../schemas/email.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

export const processEmailToTask = tool({
  description: "Convert an email into a scheduled task",
  parameters: z.object({
    emailId: z.string(),
    taskTitle: z.string().optional().describe("Override auto-generated title"),
    schedule: z.enum(['today', 'tomorrow', 'next_week', 'backlog']).default('today'),
  }),
  execute: async ({ emailId, taskTitle, schedule }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'processEmailToTask',
      operation: 'create' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const taskService = ServiceFactory.getInstance().getTaskService();
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // Read email content directly
      const email = await gmailService.getMessage(emailId);
      
      if (!email) {
        return buildErrorResponse(
          toolOptions,
          new Error(`Email with ID ${emailId} not found`),
          {
            title: 'Email not found',
            description: 'Could not find the email to convert to a task',
          }
        );
      }
      
      // Extract email details
      const headers = email.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      
      // Extract body
      let body = '';
      if (email.payload?.parts) {
        for (const part of email.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      } else if (email.payload?.body?.data) {
        body = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
      }
      
      // Extract action items
      const actionItems = extractActionItems(body);
      
      // Determine task title
      const title = taskTitle || 
        (actionItems && actionItems.length > 0 ? actionItems[0] : null) ||
        `Follow up: ${subject}`;
      
      // Determine priority
      const priority = determineTaskPriority({ subject, body, from });
      
      // Create task with email context
      const task = await taskService.createTask({
        title,
        description: `From: ${from}\nSubject: ${subject}\n\n---\n\n${body.substring(0, 500)}${body.length > 500 ? '...' : ''}`,
        priority,
        source: 'email',
        estimatedMinutes: 30, // Default estimate
      });
      
      // Schedule based on preference
      let scheduled = false;
      let blockId: string | undefined;
      
      if (schedule !== 'backlog') {
        try {
          const scheduleService = ServiceFactory.getInstance().getScheduleService();
          const targetDate = getTargetDate(schedule);
          
          // Find or create appropriate block
          const blocks = await scheduleService.getScheduleForDate(targetDate);
          const workBlock = blocks.find(b => b.type === 'work' || b.type === 'email');
          
          if (workBlock) {
            await taskService.assignTaskToBlock(task.id, workBlock.id);
            scheduled = true;
            blockId = workBlock.id;
          }
        } catch (error) {
          console.warn('Failed to schedule task:', error);
        }
      }
      
      // Archive the email
      let emailArchived = false;
      try {
        await gmailService.archiveMessage(emailId);
        emailArchived = true;
      } catch (error) {
        console.warn('Failed to archive email:', error);
      }
      
      // Build email data for schema
      const emailData = {
        id: emailId,
        threadId: email.threadId || emailId,
        from: parseEmailAddress(from),
        to: [],
        subject,
        bodyPreview: body.substring(0, 200),
        bodyPlain: body,
        receivedAt: new Date(date).toISOString(),
        isRead: true,
        urgency: priority === 'high' ? 'urgent' : priority === 'medium' ? 'important' : 'normal',
      };
      
      const emailToTask: EmailToTask = {
        emailId,
        email: emailData as any, // Type assertion needed due to complex schema
        suggestedTask: {
          title: task.title,
          description: task.description || '',
          priority: task.priority,
          estimatedMinutes: task.estimatedMinutes,
          dueDate: schedule !== 'backlog' ? getTargetDate(schedule) : undefined,
        },
        createdTaskId: task.id,
      };
      
      return buildToolResponse(
        toolOptions,
        emailToTask,
        {
          type: 'card',
          title: 'Email Converted to Task',
          description: `Created task: ${task.title}`,
          priority: priority === 'high' ? 'high' : 'medium',
          components: [
            {
              type: 'taskCard',
              data: {
                id: task.id,
                title: task.title,
                priority: task.priority,
                estimatedMinutes: task.estimatedMinutes,
                status: scheduled ? 'scheduled' : 'backlog',
                description: task.description,
              },
            },
          ],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: `Task created${scheduled ? ' and scheduled' : ''}${emailArchived ? ', email archived' : ''}`,
            duration: 3000,
          },
          suggestions: scheduled
            ? ['View schedule', 'Process another email', 'Edit task details']
            : ['Schedule this task', 'Process another email', 'View task backlog'],
          actions: [
            {
              id: 'view-task',
              label: 'View Task',
              icon: 'task',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'findTasks',
                params: { id: task.id },
              },
            },
            ...(scheduled ? [{
              id: 'view-schedule',
              label: 'View Schedule',
              icon: 'calendar',
              variant: 'secondary' as const,
              action: {
                type: 'tool' as const,
                tool: 'getSchedule',
                params: { date: getTargetDate(schedule) },
              },
            }] : [{
              id: 'schedule-task',
              label: 'Schedule Task',
              icon: 'clock',
              variant: 'secondary' as const,
              action: {
                type: 'message' as const,
                message: `Schedule the task "${task.title}"`,
              },
            }]),
          ],
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to convert email to task',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
});

// Helper to parse email address
function parseEmailAddress(addressStr: string): { name: string; email: string } {
  const match = addressStr.match(/^"?([^"<]+)"?\s*<(.+)>$/);
  if (match && match[1] && match[2]) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  const parts = addressStr.split('@');
  return { name: parts[0] || 'Unknown', email: addressStr.trim() };
}

// Helper to determine task priority based on email content
function determineTaskPriority(email: { subject: string; body: string; from: string }): 'high' | 'medium' | 'low' {
  const subject = email.subject.toLowerCase();
  const body = email.body.toLowerCase();
  
  // High priority indicators
  if (
    subject.includes('urgent') ||
    subject.includes('asap') ||
    body.includes('by end of day') ||
    body.includes('critical')
  ) {
    return 'high';
  }
  
  // Low priority indicators
  if (
    subject.includes('fyi') ||
    subject.includes('newsletter') ||
    email.from.includes('noreply')
  ) {
    return 'low';
  }
  
  return 'medium';
}

// Helper to get target date based on schedule preference
function getTargetDate(schedule: 'today' | 'tomorrow' | 'next_week' | 'backlog'): string {
  const today = new Date();
  
  switch (schedule) {
    case 'today':
      return today.toISOString().substring(0, 10);
    case 'tomorrow':
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().substring(0, 10);
    case 'next_week':
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek.toISOString().substring(0, 10);
    default:
      return today.toISOString().substring(0, 10);
  }
}

// Helper function to extract action items from email body
function extractActionItems(body: string): string[] {
  const actionItems: string[] = [];
  
  // Common action patterns
  const patterns = [
    /(?:please|could you|can you|would you|need to|should|must)\s+([^.!?]+)/gi,
    /(?:action item|todo|task):\s*([^.!?\n]+)/gi,
    /(?:by|before|until)\s+(\d{1,2}\/\d{1,2}|\w+ \d{1,2})/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = body.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 10 && match[1].length < 100) {
        actionItems.push(match[1].trim());
      }
    }
  }
  
  // Deduplicate
  return [...new Set(actionItems)].slice(0, 5); // Max 5 action items
} 