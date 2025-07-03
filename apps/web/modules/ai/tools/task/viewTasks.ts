import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type TaskListResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

// Calculate priority score for a task based on multiple factors
function calculateTaskScore(task: any): number {
  let score = 50; // Base score
  
  // Priority scoring
  if (task.priority === 'high') score += 30;
  else if (task.priority === 'medium') score += 15;
  else if (task.priority === 'low') score += 5;
  
  // Days in backlog (urgency)
  const daysInBacklog = task.days_in_backlog || 0;
  if (daysInBacklog > 7) score += 20;
  else if (daysInBacklog > 3) score += 10;
  else if (daysInBacklog > 1) score += 5;
  
  // Source scoring (emails might be more urgent)
  if (task.source === 'email') score += 10;
  else if (task.source === 'calendar') score += 5;
  
  // Has due date
  if (task.dueDate) {
    const daysUntilDue = Math.floor((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 0) score += 40; // Overdue
    else if (daysUntilDue <= 1) score += 30; // Due today/tomorrow
    else if (daysUntilDue <= 3) score += 20; // Due this week
    else if (daysUntilDue <= 7) score += 10;
  }
  
  // Cap score at 100
  return Math.min(score, 100);
}

export const viewTasks = registerTool(
  createTool<typeof parameters, TaskListResponse>({
    name: 'task_viewTasks',
    description: "View tasks with scoring and filters - understands natural language like 'pending', 'todo', 'unscheduled', 'done'",
    parameters: z.object({
      query: z.string().optional().describe("Search in title or description"),
      status: z.string().optional().default('all').describe("Task status - can be natural language like 'pending', 'todo', 'unscheduled', 'done', 'finished'"),
      priority: z.enum(['high', 'medium', 'low', 'all']).optional().default('all'),
      source: z.enum(['email', 'chat', 'calendar', 'manual', 'all']).optional().default('all'),
      limit: z.number().optional().default(20).describe("Maximum number of results"),
      showScores: z.boolean().optional().default(true).describe("Show AI-calculated priority scores"),
    }),
    metadata: {
      category: 'task',
      displayName: 'View Tasks',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async (params) => {
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
      
      // Get tasks in parallel
      const [backlogTasks, scheduledTasks, completedTasks] = await Promise.all([
        normalizedStatus === 'backlog' || normalizedStatus === 'all' 
          ? taskService.getTaskBacklog()
          : Promise.resolve([]),
        normalizedStatus === 'scheduled' || normalizedStatus === 'all'
          ? taskService.getTasksByStatus('scheduled')
          : Promise.resolve([]),
        normalizedStatus === 'completed' || normalizedStatus === 'all'
          ? taskService.getTasksByStatus('completed')
          : Promise.resolve([])
      ]);
      
      // Add scoring to tasks
      const addScore = (task: any) => ({
        ...task,
        score: calculateTaskScore(task)
      });
      
      // Combine all tasks with scores
      let tasks = [...backlogTasks.map(addScore), ...scheduledTasks.map(addScore), ...completedTasks.map(addScore)];
      
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
      filteredTasks.sort((a: any, b: any) => {
        if (a.status === 'backlog' && b.status === 'backlog') {
          return (b.score || 0) - (a.score || 0);
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      
      // Apply limit
      const results = filteredTasks.slice(0, params.limit);
      
      // Calculate stats
      const stats = {
        total: results.length,
        completed: results.filter(t => t.status === 'completed').length,
        highPriority: results.filter(t => t.priority === 'high').length,
        totalEstimatedHours: results.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0) / 60,
      };
      
      console.log(`[Tool: viewTasks] Found ${results.length} tasks with filters:`, { status: normalizedStatus, priority: params.priority });
      
      // Return pure data
      return {
        success: true,
        tasks: results.map(task => ({
          id: task.id,
          title: task.title,
          priority: task.priority || 'medium' as 'high' | 'medium' | 'low',
          status: task.status as 'active' | 'completed' | 'backlog',
          score: params.showScores ? task.score : undefined,
          estimatedMinutes: task.estimatedMinutes || 30,
          daysInBacklog: task.days_in_backlog,
          description: task.description,
          dueDate: task.dueDate,
        })),
        stats,
      };
    },
  })
);

const parameters = z.object({
  query: z.string().optional().describe("Search in title or description"),
  status: z.string().optional().default('all').describe("Task status - can be natural language like 'pending', 'todo', 'unscheduled', 'done', 'finished'"),
  priority: z.enum(['high', 'medium', 'low', 'all']).optional().default('all'),
  source: z.enum(['email', 'chat', 'calendar', 'manual', 'all']).optional().default('all'),
  limit: z.number().optional().default(20).describe("Maximum number of results"),
  showScores: z.boolean().optional().default(true).describe("Show AI-calculated priority scores"),
});