import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';

export const editTask = tool({
  description: "Edit an existing task",
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
  execute: async ({ taskId, updates }) => {
    try {
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Get current task to show what changed
      const currentTask = await taskService.getTask(taskId);
      if (!currentTask) {
        return toolError(
          'TASK_NOT_FOUND',
          `Task with ID ${taskId} not found`
        );
      }
      
      // Track what's changing for better feedback
      const changes: string[] = [];
      if (updates.title && updates.title !== currentTask.title) {
        changes.push(`title from "${currentTask.title}" to "${updates.title}"`);
      }
      if (updates.estimatedMinutes && updates.estimatedMinutes !== currentTask.estimatedMinutes) {
        changes.push(`duration from ${currentTask.estimatedMinutes} to ${updates.estimatedMinutes} minutes`);
      }
      if (updates.priority && updates.priority !== currentTask.priority) {
        changes.push(`priority from ${currentTask.priority} to ${updates.priority}`);
      }
      if (updates.status && updates.status !== currentTask.status) {
        changes.push(`status from ${currentTask.status} to ${updates.status}`);
      }
      
      if (changes.length === 0) {
        return toolSuccess({
          task: currentTask,
          message: 'No changes made'
        }, {
          type: 'text',
          content: 'Task is already up to date'
        });
      }
      
      // Update the task
      const updatedTask = await taskService.updateTask(taskId, updates);
      
      // Auto-schedule if priority changed to high
      let autoScheduled = false;
      if (updates.priority === 'high' && currentTask.priority !== 'high' && updatedTask.status !== 'scheduled') {
        try {
          const scheduleService = ServiceFactory.getInstance().getScheduleService();
          const today = new Date().toISOString().substring(0, 10);
          const blocks = await scheduleService.getScheduleForDate(today);
          
          const workBlock = blocks.find(b => b.type === 'work');
          if (workBlock) {
            await taskService.assignTaskToBlock(taskId, workBlock.id);
            autoScheduled = true;
          }
        } catch (error) {
          console.warn('Failed to auto-schedule after priority change:', error);
        }
      }
      
      const result = {
        task: {
          id: updatedTask.id,
          title: updatedTask.title,
          estimatedMinutes: updatedTask.estimatedMinutes,
          priority: updatedTask.priority,
          status: updatedTask.status,
          description: updatedTask.description
        },
        changes,
        autoScheduled
      };
      
      return toolSuccess(result, {
        type: 'task',
        content: result.task
      }, {
        affectedItems: [taskId],
        suggestions: autoScheduled
          ? ['View schedule', 'Edit again', 'Complete task']
          : updatedTask.status === 'backlog' && updatedTask.priority === 'high'
          ? ['Schedule this task', 'Edit again', 'View all tasks']
          : ['View task details', 'Edit again', 'View all tasks']
      });
      
    } catch (error) {
      return toolError(
        'TASK_UPDATE_FAILED',
        `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 