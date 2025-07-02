import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type Task, type TaskSearchResult, type TaskGroup } from '../../schemas/task.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
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
  execute: async (params): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'findTasks',
      operation: 'read' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
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
      
      // Convert to schema-compliant tasks
      const formattedTasks: Task[] = results.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority || 'medium',
        status: task.status as Task['status'],
        estimatedMinutes: task.estimatedMinutes || 30,
        source: (task.source === 'chat' ? 'ai' : task.source) as Task['source'],
        createdAt: task.createdAt?.toISOString(),
      }));
      
      // Build grouped results
      const taskGroup: TaskGroup = {
        groupBy: 'status',
        groups: [
          {
            key: 'backlog',
            label: 'Backlog',
            tasks: formattedTasks.filter(t => t.status === 'backlog'),
            count: formattedTasks.filter(t => t.status === 'backlog').length,
            totalMinutes: formattedTasks.filter(t => t.status === 'backlog').reduce((sum, t) => sum + t.estimatedMinutes, 0),
          },
          {
            key: 'scheduled',
            label: 'Scheduled',
            tasks: formattedTasks.filter(t => t.status === 'scheduled'),
            count: formattedTasks.filter(t => t.status === 'scheduled').length,
            totalMinutes: formattedTasks.filter(t => t.status === 'scheduled').reduce((sum, t) => sum + t.estimatedMinutes, 0),
          },
          {
            key: 'completed',
            label: 'Completed',
            tasks: formattedTasks.filter(t => t.status === 'completed'),
            count: formattedTasks.filter(t => t.status === 'completed').length,
            totalMinutes: formattedTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.estimatedMinutes, 0),
          },
        ],
      };
      
      const searchResult: TaskSearchResult = {
        query: params.query || '',
        filters: {
          priority: params.priority !== 'all' ? [params.priority] : undefined,
          status: normalizedStatus !== 'all' ? [normalizedStatus as Task['status']] : undefined,
        },
        results: formattedTasks,
        totalCount: formattedTasks.length,
        groupedResults: taskGroup,
      };
      
      const interpretation = normalizedStatus !== params.status 
        ? `Interpreted "${params.status}" as "${normalizedStatus}"`
        : undefined;
      
      return buildToolResponse(
        toolOptions,
        searchResult,
        {
          type: 'list',
          title: 'Task Search Results',
          description: interpretation || 
            (formattedTasks.length === 0 
              ? 'No tasks found matching your criteria'
              : `Found ${formattedTasks.length} task${formattedTasks.length !== 1 ? 's' : ''}`),
          priority: 'medium',
          components: formattedTasks.slice(0, 10).map(task => ({
            type: 'taskCard' as const,
            data: task,
          })),
        },
        {
          suggestions: results.length === 0
            ? ['Try different search criteria', 'Create a new task', 'Show all tasks']
            : taskGroup.groups.find(g => g.key === 'backlog')?.count || 0 > 0
            ? ['Add tasks to today\'s schedule', 'Assign to work blocks', 'Set priorities']
            : ['View completed tasks', 'Create new tasks', 'Check schedule'],
          actions: [
            ...(taskGroup.groups.find(g => g.key === 'backlog')?.count || 0 > 0 ? [{
              id: 'schedule-tasks',
              label: 'Schedule Tasks',
              icon: 'calendar',
              variant: 'primary' as const,
              action: {
                type: 'message' as const,
                message: 'Schedule these backlog tasks',
              },
            }] : []),
            {
              id: 'create-task',
              label: 'Create Task',
              icon: 'plus',
              variant: 'secondary',
              action: {
                type: 'message',
                message: 'Create a new task',
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
          title: 'Failed to search tasks',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 