import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type Task } from '../../schemas/task.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

export const deleteTask = tool({
  description: "Delete a task permanently",
  parameters: z.object({
    taskId: z.string(),
    skipConfirmation: z.boolean().default(false),
  }),
  execute: async ({ taskId, skipConfirmation }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'deleteTask',
      operation: 'delete' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Get task details first
      const task = await taskService.getTask(taskId);
      if (!task) {
        return buildErrorResponse(
          toolOptions,
          { code: 'TASK_NOT_FOUND', message: `Task with ID ${taskId} not found` },
          { title: 'Task Not Found' }
        );
      }
      
      // If not confirmed, return confirmation request
      if (!skipConfirmation) {
        const confirmationId = crypto.randomUUID();
        
        const taskData: Task = {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority || 'medium',
          status: task.status as Task['status'],
          estimatedMinutes: task.estimatedMinutes,
          source: task.source === 'chat' ? 'ai' : task.source as Task['source'],
        };
        
        return buildToolResponse(
          toolOptions,
          { taskId, task: taskData },
          {
            type: 'confirmation',
            title: 'Confirm Task Deletion',
            description: `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
            priority: 'high',
            components: [{
              type: 'taskCard',
              data: taskData,
            }],
          },
          {
            confirmationRequired: true,
            confirmationId,
            actions: [
              {
                id: 'confirm-delete',
                label: 'Delete Task',
                icon: 'trash',
                variant: 'danger',
                action: {
                  type: 'tool',
                  tool: 'deleteTask',
                  params: { taskId, skipConfirmation: true },
                },
              },
              {
                id: 'cancel',
                label: 'Cancel',
                variant: 'secondary',
                action: {
                  type: 'message',
                  message: 'Cancelled task deletion',
                },
              },
            ],
          }
        );
      }
      
      // Check if task is currently scheduled
      const wasScheduled = task.status === 'scheduled';
      
      // Delete the task
      await taskService.deleteTask(taskId);
      
      return buildToolResponse(
        toolOptions,
        {
          deleted: true,
          taskTitle: task.title,
          wasScheduled,
        },
        {
          type: 'card',
          title: 'Task Deleted',
          description: `"${task.title}" has been permanently deleted`,
          priority: 'medium',
          components: [],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Task deleted successfully',
            duration: 3000,
          },
          suggestions: wasScheduled
            ? ['View updated schedule', 'Create new task', 'View remaining tasks']
            : ['Create new task', 'View all tasks', 'Undo (create similar task)'],
          actions: [
            {
              id: 'create-new',
              label: 'Create New Task',
              icon: 'plus',
              variant: 'primary',
              action: {
                type: 'message',
                message: 'Create a new task',
              },
            },
            ...(wasScheduled ? [{
              id: 'view-schedule',
              label: 'View Schedule',
              icon: 'calendar',
              variant: 'secondary' as const,
              action: {
                type: 'tool' as const,
                tool: 'getSchedule',
                params: {},
              },
            }] : []),
          ],
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to delete task',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 