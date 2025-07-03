import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type CreateTaskFromEmailResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  emailId: z.string().describe('ID of the email to convert to task'),
  customTitle: z.string().optional().describe('Custom title for the task'),
});

// Helper function to extract action items from email
function extractTaskInfo(subject: string, body: string): {
  title: string;
  description: string;
  estimatedMinutes: number;
} {
  // Use subject as base title
  let title = subject || 'Task from email';
  
  // Clean up common email prefixes
  title = title.replace(/^(Re:|Fwd:|RE:|FW:)\s*/gi, '').trim();
  
  // Look for action items in body
  const actionPatterns = [
    /action required:?\s*([^\n]+)/i,
    /todo:?\s*([^\n]+)/i,
    /please\s+([^\n]+)/i,
    /could you\s+([^\n]+)/i,
    /need you to\s+([^\n]+)/i,
  ];
  
  let extractedAction = '';
  for (const pattern of actionPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      extractedAction = match[1].trim();
      break;
    }
  }
  
  // If we found a specific action, use it as title
  if (extractedAction && extractedAction.length < 100) {
    title = extractedAction;
  }
  
  // Create description from body snippet
  const description = body.length > 500 
    ? body.substring(0, 500) + '...' 
    : body;
  
  // Estimate time based on keywords
  let estimatedMinutes = 30; // default
  
  if (body.toLowerCase().includes('quick') || body.toLowerCase().includes('simple')) {
    estimatedMinutes = 15;
  } else if (body.toLowerCase().includes('urgent') || body.toLowerCase().includes('asap')) {
    estimatedMinutes = 60;
  } else if (body.toLowerCase().includes('meeting') || body.toLowerCase().includes('review')) {
    estimatedMinutes = 45;
  }
  
  return { title, description, estimatedMinutes };
}

export const createTaskFromEmail = registerTool(
  createTool<typeof parameters, CreateTaskFromEmailResponse>({
    name: 'email_createTaskFromEmail',
    description: 'Convert an email into a task with smart extraction',
    parameters,
    metadata: {
      category: 'email',
      displayName: 'Create Task from Email',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ emailId, customTitle }) => {
      try {
        const emailService = ServiceFactory.getInstance().getGmailService();
        const taskService = ServiceFactory.getInstance().getTaskService();
        
        // Get the email
        const email = await emailService.getMessage(emailId);
        
        if (!email) {
          throw new Error('Email not found');
        }
        
        // Extract email details
        const headers = email.payload?.headers || [];
        const subjectHeader = headers.find(h => h.name === 'Subject');
        const fromHeader = headers.find(h => h.name === 'From');
        
        const subject = subjectHeader?.value || 'No Subject';
        const from = fromHeader?.value || 'Unknown Sender';
        
        // Extract body
        let body = '';
        if (email.payload?.body?.data) {
          try {
            body = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
          } catch {
            body = email.snippet || '';
          }
        } else {
          body = email.snippet || '';
        }
        
        // Extract task information
        const taskInfo = extractTaskInfo(subject, body);
        
        // Use custom title if provided
        if (customTitle) {
          taskInfo.title = customTitle;
        }
        
        // Add email context to description
        taskInfo.description = `From: ${from}\nSubject: ${subject}\n\n${taskInfo.description}`;
        
        // Create the task
        const task = await taskService.createTask({
          title: taskInfo.title,
          description: taskInfo.description,
          estimatedMinutes: taskInfo.estimatedMinutes,
          priority: 'medium',
          source: 'email',
        });
        
        console.log(`[Tool: createTaskFromEmail] Created task "${task.title}" from email ${emailId}`);
        
        return {
          success: true,
          task: {
            id: task.id,
            title: task.title,
            description: task.description || '',
            estimatedMinutes: task.estimatedMinutes || 30,
            source: 'email' as const,
            emailId,
          },
        };
        
      } catch (error) {
        console.error('[Tool: createTaskFromEmail] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create task from email',
          task: {
            id: '',
            title: '',
            description: '',
            estimatedMinutes: 30,
            source: 'email' as const,
            emailId,
          },
        };
      }
    },
  })
); 