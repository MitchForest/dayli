import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';

export const getUnassignedTasks = tool({
  description: 'Get all tasks that are not yet scheduled',
  parameters: z.object({}),
  execute: async () => {
    try {
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      const tasks = await taskService.getUnassignedTasks();
      
      // Group tasks by priority for better organization
      const grouped = {
        high: tasks.filter(t => t.priority === 'high'),
        medium: tasks.filter(t => t.priority === 'medium'),
        low: tasks.filter(t => t.priority === 'low')
      };
      
      // Calculate total estimated time
      const totalMinutes = tasks.reduce((sum, task) => sum + (task.estimatedMinutes || 30), 0);
      const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
      
      // Format tasks for display
      const formattedTasks = tasks.map(task => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes || 30,
        source: task.source || 'manual',
        createdAt: task.createdAt
      }));
      
      const result = {
        tasks: formattedTasks,
        stats: {
          total: tasks.length,
          byPriority: {
            high: grouped.high.length,
            medium: grouped.medium.length,
            low: grouped.low.length
          },
          totalEstimatedHours: totalHours,
          urgentCount: grouped.high.length
        },
        summary: tasks.length === 0
          ? 'No unassigned tasks in backlog'
          : `${tasks.length} unassigned tasks (${totalHours} hours estimated)`
      };
      
      return toolSuccess(result, {
        type: 'list',
        content: formattedTasks
      }, {
        suggestions: tasks.length === 0
          ? ['Create a new task', 'Check completed tasks', 'Review schedule']
          : grouped.high.length > 0
          ? ['Schedule high priority tasks', 'Create work block for tasks', 'View task details']
          : ['Schedule these tasks', 'Create work block', 'Prioritize tasks']
      });
      
    } catch (error) {
      console.error('Error in getUnassignedTasks:', error);
      return toolError(
        'FETCH_TASKS_FAILED',
        `Failed to get unassigned tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 