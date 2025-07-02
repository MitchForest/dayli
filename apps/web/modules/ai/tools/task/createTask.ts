import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, toolStreaming } from '../types';
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
  execute: async (params) => {
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Stream progress for better UX
      const streamingUpdate = toolStreaming(
        20,
        'Creating task...',
        { title: params.title }
      );
      
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
          }
        } catch (error) {
          // Non-critical error, task is still created
          console.warn('Failed to auto-schedule high priority task:', error);
        }
      }
      
      const result = {
        id: task.id,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
        priority: task.priority,
        status: task.status,
        scheduled
      };
      
      return toolSuccess(result, {
        type: 'task',
        content: result
      }, {
        affectedItems: [task.id],
        suggestions: scheduled
          ? ['View schedule', 'Create another task', 'Edit task details']
          : params.priority === 'high'
          ? ['Schedule this task', 'Create another task', 'View all tasks']
          : ['Create another task', 'View all tasks', 'Schedule for later']
      });
      
    } catch (error) {
      // Handle authentication errors specifically
      if (error instanceof Error && error.message.includes('not configured')) {
        return toolError(
          'AUTH_REQUIRED',
          'Please log in to use this feature',
          error
        );
      }
      
      return toolError(
        'TASK_CREATE_FAILED',
        `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 