import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type Task, type TaskUpdate } from '../../schemas/task.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { format } from 'date-fns';

export const completeTask = tool({
  description: 'Mark a task as completed',
  parameters: z.object({
    taskId: z.string(),
    notes: z.string().optional().describe('Completion notes or outcomes'),
  }),
  execute: async ({ taskId, notes }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'completeTask',
      operation: 'update' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      const task = await taskService.getTask(taskId);
      if (!task) {
        return buildErrorResponse(
          toolOptions,
          { code: 'TASK_NOT_FOUND', message: 'Task not found' },
          { title: 'Task Not Found' }
        );
      }
      
      if (task.status === 'completed') {
        return buildErrorResponse(
          toolOptions,
          { code: 'TASK_ALREADY_COMPLETED', message: 'Task is already completed' },
          { title: 'Task Already Completed' }
        );
      }
      
      // Store previous state
      const previousState: Task = {
        id: task.id,
        title: task.title,
        status: task.status as Task['status'],
        priority: task.priority || 'medium',
        estimatedMinutes: task.estimatedMinutes,
        description: task.description,
        source: task.source === 'chat' ? 'ai' : task.source as Task['source'],
      };
      
      // Complete the task
      const completedTask = await taskService.completeTask(taskId);
      
      // If task had notes, append completion notes
      if (notes) {
        const updatedNotes = task.description 
          ? `${task.description}\n\nCompletion notes: ${notes}`
          : `Completion notes: ${notes}`;
          
        await taskService.updateTask(taskId, { description: updatedNotes });
      }
      
      console.log(`[AI Tools] Completed task ${taskId}`);
      
      // Calculate time saved/spent
      const timeInfo = task.estimatedMinutes
        ? `Estimated time was ${task.estimatedMinutes} minutes`
        : 'No time estimate was set';
      
      const newState: Task = {
        id: completedTask.id,
        title: completedTask.title,
        status: 'completed',
        priority: completedTask.priority || 'medium',
        estimatedMinutes: completedTask.estimatedMinutes,
        description: notes ? 
          (task.description ? `${task.description}\n\nCompletion notes: ${notes}` : `Completion notes: ${notes}`) 
          : completedTask.description,
        source: completedTask.source === 'chat' ? 'ai' : completedTask.source as Task['source'],
        completedAt: new Date().toISOString(),
      };
      
      const taskUpdate: TaskUpdate = {
        taskId,
        updates: {
          status: 'completed',
          description: notes ? newState.description : undefined,
        },
        previousState,
        newState,
        changedFields: ['status', ...(notes ? ['description'] : [])],
      };
      
      return buildToolResponse(
        toolOptions,
        taskUpdate,
        {
          type: 'card',
          title: 'Task Completed',
          description: `✅ "${completedTask.title}" has been completed. ${timeInfo}.`,
          priority: 'medium',
          components: [{
            type: 'taskCard',
            data: newState,
          }],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: 'Task completed successfully',
            duration: 3000,
          },
          suggestions: [
            'View remaining tasks',
            'Complete another task',
            'Review today\'s progress',
            'Schedule tomorrow',
          ],
          actions: [
            {
              id: 'view-tasks',
              label: 'View Tasks',
              icon: 'list',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'getUnassignedTasks',
                params: {},
              },
            },
            {
              id: 'view-progress',
              label: 'Today\'s Progress',
              icon: 'chart',
              variant: 'secondary',
              action: {
                type: 'message',
                message: 'Show me my progress for today',
              },
            },
          ],
        }
      );
      
    } catch (error) {
      console.error('Error in completeTask:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to complete task',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 