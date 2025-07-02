import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type Task, type TaskUpdate } from '../../schemas/task.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

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
  execute: async ({ taskId, updates }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'editTask',
      operation: 'update' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Get current task to show what changed
      const currentTask = await taskService.getTask(taskId);
      if (!currentTask) {
        return buildErrorResponse(
          toolOptions,
          { code: 'TASK_NOT_FOUND', message: `Task with ID ${taskId} not found` },
          { title: 'Task Not Found' }
        );
      }
      
      // Track what's changing for better feedback
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
        const taskData: Task = {
          id: currentTask.id,
          title: currentTask.title,
          description: currentTask.description,
          priority: currentTask.priority || 'medium',
          status: currentTask.status as Task['status'],
          estimatedMinutes: currentTask.estimatedMinutes,
          source: currentTask.source === 'chat' ? 'ai' : currentTask.source as Task['source'],
        };
        
        return buildToolResponse(
          toolOptions,
          { task: taskData, message: 'No changes made' },
          {
            type: 'card',
            title: 'No Changes Made',
            description: 'Task is already up to date',
            priority: 'low',
            components: [{
              type: 'taskCard',
              data: taskData,
            }],
          },
          {
            suggestions: ['Edit different fields', 'View all tasks'],
          }
        );
      }
      
      // Store previous state
      const previousState: Task = {
        id: currentTask.id,
        title: currentTask.title,
        description: currentTask.description,
        priority: currentTask.priority || 'medium',
        status: currentTask.status as Task['status'],
        estimatedMinutes: currentTask.estimatedMinutes,
        source: currentTask.source === 'chat' ? 'ai' : currentTask.source as Task['source'],
      };
      
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
      
      const newState: Task = {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description,
        priority: updatedTask.priority || 'medium',
        status: updatedTask.status as Task['status'],
        estimatedMinutes: updatedTask.estimatedMinutes,
        source: updatedTask.source === 'chat' ? 'ai' : updatedTask.source as Task['source'],
      };
      
      const taskUpdate: TaskUpdate = {
        taskId,
        updates,
        previousState,
        newState,
        changedFields,
      };
      
      return buildToolResponse(
        toolOptions,
        taskUpdate,
        {
          type: 'card',
          title: 'Task Updated',
          description: autoScheduled 
            ? `"${updatedTask.title}" updated and auto-scheduled`
            : `"${updatedTask.title}" updated successfully`,
          priority: updates.priority === 'high' ? 'high' : 'medium',
          components: [{
            type: 'taskCard',
            data: newState,
          }],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: `Updated ${changedFields.length} field${changedFields.length > 1 ? 's' : ''}`,
            duration: 3000,
          },
          suggestions: autoScheduled
            ? ['View schedule', 'Edit again', 'Complete task']
            : updatedTask.status === 'backlog' && updatedTask.priority === 'high'
            ? ['Schedule this task', 'Edit again', 'View all tasks']
            : ['View task details', 'Edit again', 'View all tasks'],
          actions: [
            ...(autoScheduled ? [{
              id: 'view-schedule',
              label: 'View Schedule',
              icon: 'calendar',
              variant: 'primary' as const,
              action: {
                type: 'tool' as const,
                tool: 'getSchedule',
                params: {},
              },
            }] : updatedTask.status === 'backlog' ? [{
              id: 'schedule-task',
              label: 'Schedule Task',
              icon: 'clock',
              variant: 'primary' as const,
              action: {
                type: 'message' as const,
                message: `Schedule the task "${updatedTask.title}"`,
              },
            }] : []),
            {
              id: 'complete-task',
              label: 'Complete Task',
              icon: 'check',
              variant: 'secondary',
              action: {
                type: 'tool',
                tool: 'completeTask',
                params: { taskId },
              },
            },
          ],
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to update task',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 