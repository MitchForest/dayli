import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type CreateTaskResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

export const createTask = registerTool(
  createTool<typeof parameters, CreateTaskResponse>({
    name: 'task_createTask',
    description: "Create a new task",
    parameters: z.object({
      title: z.string().describe("Task title"),
      estimatedMinutes: z.number().optional().default(30),
      description: z.string().optional(),
      priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
      source: z.enum(['email', 'chat', 'calendar', 'manual']).optional().default('chat'),
      metadata: z.record(z.string()).optional(),
    }),
    metadata: {
      category: 'task',
      displayName: 'Create Task',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async (params) => {
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Create the task
      const task = await taskService.createTask({
        title: params.title,
        estimatedMinutes: params.estimatedMinutes,
        description: params.description,
        priority: params.priority,
        source: params.source,
      });
      
      console.log(`[Tool: createTask] Created task "${task.title}" with priority ${task.priority}`);
      
      // Return pure data
      return {
        success: true,
        task: {
          id: task.id,
          title: task.title,
          priority: task.priority || 'medium',
          estimatedMinutes: task.estimatedMinutes || 30,
          description: task.description,
          status: task.status || 'backlog',
        },
      };
    },
  })
);

const parameters = z.object({
  title: z.string().describe("Task title"),
  estimatedMinutes: z.number().optional().default(30),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  source: z.enum(['email', 'chat', 'calendar', 'manual']).optional().default('chat'),
  metadata: z.record(z.string()).optional(),
}); 