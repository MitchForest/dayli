import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { readEmailContent } from './readEmailContent';

export const processEmailToTask = tool({
  description: "Convert an email into a scheduled task",
  parameters: z.object({
    emailId: z.string(),
    taskTitle: z.string().optional().describe("Override auto-generated title"),
    schedule: z.enum(['today', 'tomorrow', 'next_week', 'backlog']).default('today'),
  }),
  execute: async ({ emailId, taskTitle, schedule }) => {
    try {
      const taskService = ServiceFactory.getInstance().getTaskService();
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // Read email content
      const emailResult = await readEmailContent.execute({ 
        emailId, 
        includeAttachments: false 
      }, {} as any);
      
      if (!emailResult.success || !emailResult.data) {
        return toolError(
          'EMAIL_READ_FAILED',
          'Failed to read email content',
          emailResult.error
        );
      }
      
      const email = emailResult.data;
      
      // Determine task title
      const title = taskTitle || 
        (email.actionItems && email.actionItems.length > 0 ? email.actionItems[0] : null) ||
        `Follow up: ${email.subject}`;
      
      // Create task with email context
      const task = await taskService.createTask({
        title,
        description: `From: ${email.from}\nSubject: ${email.subject}\n\n---\n\n${email.body.substring(0, 500)}${email.body.length > 500 ? '...' : ''}`,
        priority: determineTaskPriority(email),
        source: 'email',
        estimatedMinutes: 30, // Default estimate
      });
      
      // Schedule based on preference
      let scheduled = false;
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
          }
        } catch (error) {
          console.warn('Failed to schedule task:', error);
        }
      }
      
      // Archive the email
      try {
        await gmailService.archiveMessage(emailId);
      } catch (error) {
        console.warn('Failed to archive email:', error);
      }
      
      const result = {
        task: {
          id: task.id,
          title: task.title,
          priority: task.priority,
          status: scheduled ? 'scheduled' : 'backlog'
        },
        emailArchived: true,
        scheduled,
        emailSubject: email.subject
      };
      
      return toolSuccess(result, {
        type: 'task',
        content: result.task
      }, {
        affectedItems: [task.id, emailId],
        suggestions: scheduled
          ? ['View schedule', 'Process another email', 'Edit task details']
          : ['Schedule this task', 'Process another email', 'View task backlog']
      });
      
    } catch (error) {
      return toolError(
        'EMAIL_TO_TASK_FAILED',
        `Failed to convert email to task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
});

// Helper to determine task priority based on email content
function determineTaskPriority(email: any): 'high' | 'medium' | 'low' {
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