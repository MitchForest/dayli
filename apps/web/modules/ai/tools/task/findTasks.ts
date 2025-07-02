import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';

export const findTasks = tool({
  description: "Search for tasks by various criteria - understands natural language like 'pending', 'todo', 'unscheduled', 'done'",
  parameters: z.object({
    query: z.string().optional().describe("Search in title or description"),
    status: z.string().optional().default('all').describe("Task status - can be natural language like 'pending', 'todo', 'unscheduled', 'done', 'finished'"),
    priority: z.enum(['high', 'medium', 'low', 'all']).optional().default('all'),
    source: z.enum(['email', 'chat', 'calendar', 'manual', 'all']).optional().default('all'),
    limit: z.number().optional().default(10).describe("Maximum number of results"),
  }),
  execute: async (params) => {
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const taskService = ServiceFactory.getInstance().getTaskService();
      
      // Map user intent to database values
      const statusMap: Record<string, string> = {
        // User might say these -> map to database value
        'pending': 'backlog',
        'todo': 'backlog',
        'to do': 'backlog',
        'unscheduled': 'backlog',
        'not done': 'backlog',
        'incomplete': 'backlog',
        'backlog': 'backlog',
        'scheduled': 'scheduled',
        'assigned': 'scheduled',
        'planned': 'scheduled',
        'completed': 'completed',
        'done': 'completed',
        'finished': 'completed',
        'complete': 'completed',
        'all': 'all'
      };
      
      // Normalize the status parameter
      const normalizedStatus = statusMap[params.status.toLowerCase()] || params.status;
      
      // Get all tasks first (in a real implementation, this would be filtered at DB level)
      let tasks = await taskService.getUnassignedTasks();
      
      // If looking for scheduled/completed tasks, fetch those too
      if (normalizedStatus === 'scheduled' || normalizedStatus === 'all') {
        const scheduledTasks = await taskService.getTasksByStatus('scheduled');
        tasks = [...tasks, ...scheduledTasks];
      }
      
      if (normalizedStatus === 'completed' || normalizedStatus === 'all') {
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
      if (normalizedStatus !== 'all') {
        filteredTasks = filteredTasks.filter(task => 
          task.status === normalizedStatus
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
      
      // Format tasks for display
      const formattedTasks = results.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority || 'medium',
        estimatedMinutes: task.estimatedMinutes || 30,
        source: task.source || 'manual',
        createdAt: task.createdAt,
        description: task.description
      }));
      
      return toolSuccess({
        tasks: formattedTasks,
        summary,
        query: params,
        interpretation: normalizedStatus !== params.status 
          ? `Interpreted "${params.status}" as "${normalizedStatus}"`
          : undefined
      }, {
        type: 'list',
        content: formattedTasks
      }, {
        suggestions: results.length === 0
          ? ['Try different search criteria', 'Create a new task', 'Show all tasks']
          : grouped.backlog.length > 0
          ? ['Add tasks to today\'s schedule', 'Assign to work blocks', 'Set priorities']
          : ['View completed tasks', 'Create new tasks', 'Check schedule']
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