import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { type Task, type TaskGroup, type TaskSearchResult } from '../../schemas/task.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';
import { createClient } from '@/lib/supabase-client';
import type { Tables } from '@/database.types';

type TaskBacklogRow = Tables<'task_backlog'>;
type TaskRow = Tables<'tasks'>;

interface TaskWithScore {
  id: string;
  title: string;
  description?: string;
  priority: number; // 0-100 for backlog, converted for tasks table
  urgency: number; // 0-100
  estimatedMinutes: number;
  source: string;
  createdAt: string;
  daysInBacklog: number;
  score: number;
  priorityLabel: 'high' | 'medium' | 'low';
}

// Convert text priority to numeric
function textPriorityToNumeric(priority: string | null): number {
  switch (priority) {
    case 'high': return 80;
    case 'medium': return 50;
    case 'low': return 20;
    default: return 50;
  }
}

// Calculate task score
function calculateTaskScore(task: TaskWithScore): number {
  const priorityWeight = 0.6;
  const urgencyWeight = 0.4;
  const ageBonus = Math.min(task.daysInBacklog * 2, 20); // Max 20 point bonus
  
  return (task.priority * priorityWeight) + 
         (task.urgency * urgencyWeight) + 
         ageBonus;
}

// Get priority label from numeric score
function getPriorityLabel(priority: number): 'high' | 'medium' | 'low' {
  if (priority >= 70) return 'high';
  if (priority >= 40) return 'medium';
  return 'low';
}

export const getUnassignedTasks = tool({
  description: 'Get all unassigned tasks from both tasks and task_backlog tables, intelligently sorted by priority and urgency',
  parameters: z.object({
    includeCompleted: z.boolean().default(false).describe('Include completed tasks'),
    limit: z.number().default(50).describe('Maximum number of tasks to return'),
  }),
  execute: async ({ includeCompleted, limit }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'getUnassignedTasks',
      operation: 'read' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const supabase = createClient();
      
      // Query task_backlog table (has numeric priority/urgency)
      const { data: backlogTasks, error: backlogError } = await supabase
        .from('task_backlog')
        .select('*')
        .order('priority', { ascending: false })
        .limit(limit);
      
      if (backlogError) {
        console.error('Error fetching from task_backlog:', backlogError);
      }
      
      // Query tasks table (has text priority)
      const tasksQuery = supabase
        .from('tasks')
        .select('*')
        .eq('status', 'backlog');
      
      if (!includeCompleted) {
        tasksQuery.eq('completed', false);
      }
      
      const { data: regularTasks, error: tasksError } = await tasksQuery
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (tasksError) {
        console.error('Error fetching from tasks:', tasksError);
      }
      
      // Combine and normalize all tasks
      const allTasks: TaskWithScore[] = [];
      
      // Process task_backlog tasks
      if (backlogTasks) {
        backlogTasks.forEach((task: TaskBacklogRow) => {
          const createdAt = task.created_at || new Date().toISOString();
          const daysInBacklog = Math.floor(
            (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          const normalizedTask: TaskWithScore = {
            id: task.id,
            title: task.title,
            description: task.description ?? undefined,
            priority: task.priority ?? 50,
            urgency: task.urgency ?? 50,
            estimatedMinutes: task.estimated_minutes ?? 30,
            source: task.source ?? 'manual',
            createdAt,
            daysInBacklog,
            score: 0, // Will be calculated
            priorityLabel: getPriorityLabel(task.priority ?? 50)
          };
          
          normalizedTask.score = calculateTaskScore(normalizedTask);
          allTasks.push(normalizedTask);
        });
      }
      
      // Process regular tasks table
      if (regularTasks) {
        regularTasks.forEach((task: TaskRow) => {
          const createdAt = task.created_at || new Date().toISOString();
          const daysInBacklog = Math.floor(
            (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          const numericPriority = textPriorityToNumeric(task.priority);
          
          const normalizedTask: TaskWithScore = {
            id: task.id,
            title: task.title,
            description: task.description ?? undefined,
            priority: numericPriority,
            urgency: numericPriority, // Use same as priority for tasks table
            estimatedMinutes: task.estimated_minutes ?? 30,
            source: task.source ?? 'manual',
            createdAt,
            daysInBacklog,
            score: 0,
            priorityLabel: task.priority === 'high' || task.priority === 'medium' || task.priority === 'low' 
              ? task.priority 
              : 'medium'
          };
          
          normalizedTask.score = calculateTaskScore(normalizedTask);
          allTasks.push(normalizedTask);
        });
      }
      
      // Sort by score (highest first)
      allTasks.sort((a, b) => b.score - a.score);
      
      // Take only the requested limit
      const topTasks = allTasks.slice(0, limit);
      
      // Convert to schema-compliant tasks
      const tasks: Task[] = topTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priorityLabel,
        status: 'backlog' as const,
        estimatedMinutes: t.estimatedMinutes,
        source: (t.source === 'chat' ? 'ai' : t.source) as Task['source'],
        metadata: {
          score: Math.round(t.score),
          daysInBacklog: t.daysInBacklog,
          urgency: t.urgency,
        },
      }));
      
      // Group by priority for structured response
      const taskGroup: TaskGroup = {
        groupBy: 'priority',
        groups: [
          {
            key: 'high',
            label: 'High Priority',
            tasks: tasks.filter(t => t.priority === 'high'),
            count: tasks.filter(t => t.priority === 'high').length,
            totalMinutes: tasks.filter(t => t.priority === 'high').reduce((sum, t) => sum + t.estimatedMinutes, 0),
          },
          {
            key: 'medium',
            label: 'Medium Priority',
            tasks: tasks.filter(t => t.priority === 'medium'),
            count: tasks.filter(t => t.priority === 'medium').length,
            totalMinutes: tasks.filter(t => t.priority === 'medium').reduce((sum, t) => sum + t.estimatedMinutes, 0),
          },
          {
            key: 'low',
            label: 'Low Priority',
            tasks: tasks.filter(t => t.priority === 'low'),
            count: tasks.filter(t => t.priority === 'low').length,
            totalMinutes: tasks.filter(t => t.priority === 'low').reduce((sum, t) => sum + t.estimatedMinutes, 0),
          },
        ],
      };
      
      // Calculate statistics
      const totalMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
      const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
      
      // Find urgent tasks (score > 70)
      const urgentTasks = topTasks.filter(t => t.score > 70);
      
      // Find quick wins (high score, low time)
      const quickWins = topTasks.filter(t => t.score > 60 && t.estimatedMinutes <= 30);
      
      const searchResult: TaskSearchResult = {
        query: 'unassigned tasks',
        results: tasks,
        totalCount: allTasks.length,
        groupedResults: taskGroup,
      };
      
      return buildToolResponse(
        toolOptions,
        searchResult,
        {
          type: 'list',
          title: 'Unassigned Tasks',
          description: tasks.length === 0
            ? 'No unassigned tasks found'
            : `${tasks.length} tasks (${totalHours}h) • ${urgentTasks.length} urgent • ${quickWins.length} quick wins`,
          priority: urgentTasks.length > 0 ? 'high' : 'medium',
          components: tasks.slice(0, 10).map(task => ({
            type: 'taskCard' as const,
            data: task,
          })),
        },
        {
          suggestions: tasks.length === 0
            ? ['Create a new task', 'Check completed tasks', 'Review schedule']
            : urgentTasks.length > 0
            ? ['Schedule urgent tasks now', 'Create a work block for high-priority items', 'Review task priorities']
            : quickWins.length > 0
            ? ['Knock out some quick wins', 'Batch small tasks together', 'Schedule a focus block']
            : ['Plan your day', 'Create work blocks', 'Review and prioritize tasks'],
          actions: [
            ...(urgentTasks.length > 0 ? [{
              id: 'schedule-urgent',
              label: 'Schedule Urgent Tasks',
              icon: 'clock',
              variant: 'primary' as const,
              action: {
                type: 'message' as const,
                message: 'Schedule my most urgent tasks',
              },
            }] : []),
            {
              id: 'create-work-block',
              label: 'Create Work Block',
              icon: 'plus',
              variant: 'secondary' as const,
              action: {
                type: 'message' as const,
                message: 'Create a work block for these tasks',
              },
            },
          ],
        }
      );
      
    } catch (error) {
      console.error('Error in getUnassignedTasks:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to get unassigned tasks',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
}); 