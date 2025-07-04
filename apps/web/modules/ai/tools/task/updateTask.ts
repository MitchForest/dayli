import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type UpdateTaskResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

export const updateTask = registerTool(
  createTool<typeof parameters, UpdateTaskResponse>({
    name: 'task_updateTask',
    description: "Update an existing task",
    parameters: z.object({
      taskId: z.string(),
      updates: z.object({
        title: z.string().optional(),
        estimatedMinutes: z.number().optional(),
        description: z.string().optional(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
        status: z.enum(['backlog', 'scheduled', 'completed']).optional(),
      }).describe("Fields to update"),
    }),
    metadata: {
      category: 'task',
      displayName: 'Update Task',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ taskId, updates }) => {
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Get current task to show what changed
      const currentTask = await taskService.getTask(taskId);
      if (!currentTask) {
        return {
          success: false,
          error: `Task with ID ${taskId} not found`,
          task: {
            id: taskId,
            title: '',
            priority: 'medium',
            status: 'backlog',
            updatedFields: [],
          },
        };
      }
      
      // Track what's changing
      const changedFields: string[] = [];
      if (updates.title && updates.title !== currentTask.title) {
        changedFields.push('title');
      }
      if (updates.estimatedMinutes && updates.estimatedMinutes !== currentTask.estimatedMinutes) {
        changedFields.push('estimatedMinutes');
      }
      if (updates.priority && updates.priority !== currentTask.priority) {
        changedFields.push('priority');
      }
      if (updates.status && updates.status !== currentTask.status) {
        changedFields.push('status');
      }
      if (updates.description !== undefined && updates.description !== currentTask.description) {
        changedFields.push('description');
      }
      
      if (changedFields.length === 0) {
        console.log(`[Tool: updateTask] No changes made to task ${taskId}`);
        return {
          success: true,
          task: {
            id: currentTask.id,
            title: currentTask.title,
            priority: currentTask.priority || 'medium',
            status: currentTask.status || 'backlog',
            updatedFields: [],
          },
        };
      }
      
      // Update the task
      const updatedTask = await taskService.updateTask(taskId, updates);
      
      console.log(`[Tool: updateTask] Updated task ${taskId} - changed fields: ${changedFields.join(', ')}`);
      
      // Return pure data
      return {
        success: true,
        task: {
          id: updatedTask.id,
          title: updatedTask.title,
          priority: updatedTask.priority || 'medium',
          status: updatedTask.status || 'backlog',
          updatedFields: changedFields,
        },
      };
    },
  })
);

const parameters = z.object({
  taskId: z.string(),
  updates: z.object({
    title: z.string().optional(),
    estimatedMinutes: z.number().optional(),
    description: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    status: z.enum(['backlog', 'scheduled', 'completed']).optional(),
  }).describe("Fields to update"),
}); 