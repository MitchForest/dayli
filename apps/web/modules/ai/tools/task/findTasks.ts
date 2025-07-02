import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';

export const findTasks = tool({
  description: "Search for tasks by various criteria",
  parameters: z.object({
    query: z.string().optional().describe("Search in title or description"),
    status: z.enum(['pending', 'scheduled', 'completed', 'all']).optional().default('all'),
    priority: z.enum(['high', 'medium', 'low', 'all']).optional().default('all'),
    source: z.enum(['email', 'chat', 'calendar', 'manual', 'all']).optional().default('all'),
    limit: z.number().optional().default(10).describe("Maximum number of results"),
  }),
  execute: async (params) => {
    try {
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Get all tasks first (in a real implementation, this would be filtered at DB level)
      let tasks = await taskService.getUnassignedTasks();
      
      // If looking for scheduled/completed tasks, fetch those too
      if (params.status === 'scheduled' || params.status === 'all') {
        const scheduledTasks = await taskService.getTasksByStatus('scheduled');
        tasks = [...tasks, ...scheduledTasks];
      }
      
      if (params.status === 'completed' || params.status === 'all') {
        const completedTasks = await taskService.getTasksByStatus('completed');
        tasks = [...tasks, ...completedTasks];
      }
      
      // Apply filters
      let filteredTasks = tasks;
      
      // Text search
      if (params.query) {
        const searchLower = params.query.toLowerCase();
        filteredTasks = filteredTasks.filter(task => 
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower)
        );
      }
      
      // Status filter
      if (params.status !== 'all') {
        const statusMap = {
          'pending': 'backlog',
          'scheduled': 'scheduled',
          'completed': 'completed'
        };
        filteredTasks = filteredTasks.filter(task => 
          task.status === statusMap[params.status as keyof typeof statusMap]
        );
      }
      
      // Priority filter
      if (params.priority !== 'all') {
        filteredTasks = filteredTasks.filter(task => 
          task.priority === params.priority
        );
      }
      
      // Source filter
      if (params.source !== 'all') {
        filteredTasks = filteredTasks.filter(task => 
          task.source === params.source
        );
      }
      
      // Apply limit
      const results = filteredTasks.slice(0, params.limit);
      
      // Group by status for better display
      const grouped = {
        backlog: results.filter(t => t.status === 'backlog'),
        scheduled: results.filter(t => t.status === 'scheduled'),
        completed: results.filter(t => t.status === 'completed')
      };
      
      const summary = {
        total: results.length,
        byStatus: {
          backlog: grouped.backlog.length,
          scheduled: grouped.scheduled.length,
          completed: grouped.completed.length
        },
        byPriority: {
          high: results.filter(t => t.priority === 'high').length,
          medium: results.filter(t => t.priority === 'medium').length,
          low: results.filter(t => t.priority === 'low').length
        }
      };
      
      return toolSuccess({
        tasks: results.map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          estimatedMinutes: task.estimatedMinutes,
          source: task.source,
          createdAt: task.createdAt
        })),
        summary,
        query: params
      }, {
        type: 'list',
        content: results
      }, {
        suggestions: results.length === 0
          ? ['Try different search criteria', 'Create a new task', 'Show all tasks']
          : results.length >= params.limit
          ? ['Show more results', 'Refine search', 'Schedule high priority tasks']
          : ['Schedule these tasks', 'Edit a task', 'Create new task']
      });
      
    } catch (error) {
      return toolError(
        'TASK_SEARCH_FAILED',
        `Failed to search tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
}); 