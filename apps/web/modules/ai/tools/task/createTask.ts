import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type Task } from '../../schemas/task.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

export const createTask = tool({
  description: "Create a new task from natural language",
  parameters: z.object({
    title: z.string().describe("Task title"),
    estimatedMinutes: z.number().optional().default(30),
    description: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
    source: z.enum(['email', 'chat', 'calendar', 'manual']).optional().default('chat'),
    metadata: z.record(z.string()).optional(),
  }),
  execute: async (params): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'createTask',
      operation: 'create' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Create the task
      const task = await taskService.createTask({
        title: params.title,
        estimatedMinutes: params.estimatedMinutes,
        description: params.description,
        priority: params.priority,
        source: params.source,
      });
      
      // Add to today's schedule if high priority
      let scheduled = false;
      let assignedBlock = null;
      
      if (params.priority === 'high') {
        try {
          const scheduleService = ServiceFactory.getInstance().getScheduleService();
          const today = new Date().toISOString().substring(0, 10);
          const blocks = await scheduleService.getScheduleForDate(today);
          
          // Find first work block
          const workBlock = blocks.find(b => b.type === 'work');
          if (workBlock) {
            await taskService.assignTaskToBlock(task.id, workBlock.id);
            scheduled = true;
            assignedBlock = workBlock;
          }
        } catch (error) {
          // Non-critical error, task is still created
          console.warn('Failed to auto-schedule high priority task:', error);
        }
      }
      
      const taskData: Task = {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority || 'medium',
        status: task.status as Task['status'],
        estimatedMinutes: task.estimatedMinutes,
        source: params.source === 'chat' ? 'ai' : params.source as Task['source'],
        metadata: params.metadata,
        assignedToBlockId: assignedBlock?.id,
      };
      
      return buildToolResponse(
        toolOptions,
        taskData,
        {
          type: 'card',
          title: 'Task Created',
          description: scheduled 
            ? `"${task.title}" created and scheduled to your work block`
            : `"${task.title}" created successfully`,
          priority: params.priority === 'high' ? 'high' : 'medium',
          components: [{
            type: 'taskCard',
            data: taskData,
          }],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: scheduled 
              ? 'Task created and scheduled'
              : 'Task created successfully',
            duration: 3000,
          },
          suggestions: scheduled
            ? ['View schedule', 'Create another task', 'Edit task details']
            : params.priority === 'high'
            ? ['Schedule this task', 'Create another task', 'View all tasks']
            : ['Create another task', 'View all tasks', 'Schedule for later'],
          actions: [
            ...(scheduled ? [{
              id: 'view-schedule',
              label: 'View Schedule',
              icon: 'calendar',
              variant: 'primary' as const,
              action: {
                type: 'tool' as const,
                tool: 'getSchedule',
                params: {},
              },
            }] : [{
              id: 'schedule-task',
              label: 'Schedule Task',
              icon: 'clock',
              variant: 'primary' as const,
              action: {
                type: 'message' as const,
                message: `Schedule the task "${task.title}"`,
              },
            }]),
            {
              id: 'create-another',
              label: 'Create Another',
              icon: 'plus',
              variant: 'secondary',
              action: {
                type: 'message',
                message: 'Create another task',
              },
            },
          ],
        },
        {
          supported: true,
          progress: 100,
          stage: 'complete',
        }
      );
      
    } catch (error) {
      // Handle authentication errors specifically
      if (error instanceof Error && error.message.includes('not configured')) {
        return buildErrorResponse(
          toolOptions,
          error,
          {
            title: 'Authentication Required',
            description: 'Please log in to use this feature',
          }
        );
      }
      
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to create task',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 