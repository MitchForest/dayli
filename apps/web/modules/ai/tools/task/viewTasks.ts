import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type Task, type TaskSearchResult, type TaskGroup } from '../../schemas/task.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';

export const viewTasks = tool({
  description: "View tasks with scoring and filters - understands natural language like 'pending', 'todo', 'unscheduled', 'done'",
  parameters: z.object({
    query: z.string().optional().describe("Search in title or description"),
    status: z.string().optional().default('all').describe("Task status - can be natural language like 'pending', 'todo', 'unscheduled', 'done', 'finished'"),
    priority: z.enum(['high', 'medium', 'low', 'all']).optional().default('all'),
    source: z.enum(['email', 'chat', 'calendar', 'manual', 'all']).optional().default('all'),
    limit: z.number().optional().default(20).describe("Maximum number of results"),
    showScores: z.boolean().optional().default(true).describe("Show AI-calculated priority scores"),
  }),
  execute: async (params): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'viewTasks',
      operation: 'read' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
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
      
      // Get tasks with scores in parallel
      const [backlogTasks, scheduledTasks, completedTasks] = await Promise.all([
        normalizedStatus === 'backlog' || normalizedStatus === 'all' 
          ? taskService.getTasksWithScores({ status: ['backlog'], userId: '' })
          : Promise.resolve([]),
        normalizedStatus === 'scheduled' || normalizedStatus === 'all'
          ? taskService.getTasksByStatus('scheduled')
          : Promise.resolve([]),
        normalizedStatus === 'completed' || normalizedStatus === 'all'
          ? taskService.getTasksByStatus('completed')
          : Promise.resolve([])
      ]);
      
      // Combine all tasks
      let tasks = [...backlogTasks, ...scheduledTasks, ...completedTasks];
      
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
      
      // Sort by score for backlog items, by date for others
      filteredTasks.sort((a, b) => {
        if (a.status === 'backlog' && b.status === 'backlog') {
          return (b.score || 0) - (a.score || 0);
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      
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
        score: params.showScores ? task.score : undefined,
        daysInBacklog: task.days_in_backlog,
        tags: task.tags,
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
        ].filter(g => g.count > 0), // Only show groups with tasks
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
          title: 'Tasks',
          description: interpretation || 
            (formattedTasks.length === 0 
              ? 'No tasks found matching your criteria'
              : `${formattedTasks.length} task${formattedTasks.length !== 1 ? 's' : ''} found`),
          priority: 'medium',
          components: [
            {
              type: 'taskList',
              data: {
                tasks: formattedTasks,
                showScore: params.showScores,
                groupBy: 'status',
              },
            },
          ],
        },
        {
          suggestions: results.length === 0
            ? ['Try different search criteria', 'Create a new task', 'Show all tasks']
            : taskGroup.groups.find(g => g.key === 'backlog')?.count || 0 > 0
            ? ['Schedule high-priority tasks', 'Fill work blocks', 'Set task priorities']
            : ['View backlog tasks', 'Create new tasks', 'Check schedule'],
          actions: [
            ...(taskGroup.groups.find(g => g.key === 'backlog')?.count || 0 > 0 ? [{
              id: 'schedule-tasks',
              label: 'Schedule Tasks',
              icon: 'calendar',
              variant: 'primary' as const,
              action: {
                type: 'message' as const,
                message: 'Schedule my highest priority tasks',
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
          notification: params.showScores && taskGroup.groups.find(g => g.key === 'backlog')?.count || 0 > 0
            ? {
                show: true,
                type: 'info',
                message: 'Tasks are scored by priority, urgency, and age',
                duration: 3000,
              }
            : undefined,
        }
      );
      
    } catch (error) {
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to view tasks',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
});