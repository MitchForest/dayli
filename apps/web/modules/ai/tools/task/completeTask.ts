import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type CompleteTaskResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

export const completeTask = registerTool(
  createTool<typeof parameters, CompleteTaskResponse>({
    name: 'task_completeTask',
    description: 'Mark a task as completed',
    parameters: z.object({
      taskId: z.string(),
      notes: z.string().optional().describe('Completion notes or outcomes'),
    }),
    metadata: {
      category: 'task',
      displayName: 'Complete Task',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ taskId, notes }) => {
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      const task = await taskService.getTask(taskId);
      if (!task) {
        return {
          success: false,
          error: 'Task not found',
          taskId: taskId,
          title: '',
          completedAt: new Date(),
        };
      }
      
      if (task.status === 'completed') {
        return {
          success: false,
          error: 'Task is already completed',
          taskId: taskId,
          title: task.title,
          completedAt: new Date(),
        };
      }
      
      // Complete the task
      const completedTask = await taskService.completeTask(taskId);
      
      // If task had notes, append completion notes
      if (notes) {
        const updatedNotes = task.description 
          ? `${task.description}\n\nCompletion notes: ${notes}`
          : `Completion notes: ${notes}`;
          
        await taskService.updateTask(taskId, { description: updatedNotes });
      }
      
      console.log(`[Tool: completeTask] Completed task ${taskId}`);
      
      // Return pure data
      return {
        success: true,
        taskId: taskId,
        title: completedTask.title,
        completedAt: new Date(),
      };
      
    },
  })
);

const parameters = z.object({
  taskId: z.string(),
  notes: z.string().optional().describe('Completion notes or outcomes'),
}); 