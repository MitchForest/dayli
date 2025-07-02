import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { differenceInDays, subDays } from 'date-fns';

interface BacklogHealth {
  score: number; // 0-100
  status: 'healthy' | 'warning' | 'critical';
  metrics: {
    totalTasks: number;
    staleTasks: number;
    criticalTasks: number;
    avgAge: number;
    growthRate: number;
    completionRate: number;
  };
  issues: string[];
  recommendations: string[];
}

export const getTaskBacklogHealth = tool({
  description: 'Analyze task backlog health with metrics on aging, growth, and completion trends',
  parameters: z.object({
    includeDetails: z.boolean().optional().default(false).describe('Include detailed task list'),
  }),
  execute: async ({ includeDetails }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'getTaskBacklogHealth',
      operation: 'read' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const taskService = ServiceFactory.getInstance().getTaskService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Get all tasks for analysis
      const [backlogTasks, completedTasks] = await Promise.all([
        taskService.getTasksByStatus('backlog'),
        taskService.getTasksByStatus('completed'),
      ]);
      
      // Calculate aging metrics
      const now = new Date();
      const taskAges = backlogTasks.map(task => {
        const createdDate = new Date(task.createdAt || now);
        return differenceInDays(now, createdDate);
      });
      
      const avgAge = taskAges.length > 0 
        ? taskAges.reduce((sum, age) => sum + age, 0) / taskAges.length
        : 0;
      
      const staleTasks = taskAges.filter(age => age > 7).length;
      const criticalTasks = taskAges.filter(age => age > 14).length;
      
      // Calculate growth rate (tasks added vs completed in last 7 days)
      const weekAgo = subDays(now, 7);
      const recentlyAdded = backlogTasks.filter(task => 
        new Date(task.createdAt || now) > weekAgo
      ).length;
      
      const recentlyCompleted = completedTasks.filter(task => 
        new Date(task.updatedAt || task.createdAt || now) > weekAgo
      ).length;
      
      const growthRate = recentlyAdded - recentlyCompleted;
      
      // Calculate completion rate
      const totalTasksEver = backlogTasks.length + completedTasks.length;
      const completionRate = totalTasksEver > 0 
        ? (completedTasks.length / totalTasksEver) * 100
        : 0;
      
      // Calculate health score
      let score = 100;
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      // Penalize for stale tasks
      if (staleTasks > 0) {
        score -= Math.min(20, staleTasks * 2);
        issues.push(`${staleTasks} tasks older than 7 days`);
      }
      
      if (criticalTasks > 0) {
        score -= Math.min(20, criticalTasks * 5);
        issues.push(`${criticalTasks} tasks older than 14 days`);
        recommendations.push('Review and archive or complete old tasks');
      }
      
      // Penalize for high average age
      if (avgAge > 5) {
        score -= Math.min(15, Math.floor(avgAge));
        issues.push(`Average task age is ${Math.round(avgAge)} days`);
      }
      
      // Penalize for growing backlog
      if (growthRate > 5) {
        score -= 15;
        issues.push('Backlog growing faster than completion');
        recommendations.push('Schedule focused work sessions to reduce backlog');
      }
      
      // Penalize for low completion rate
      if (completionRate < 50 && totalTasksEver > 10) {
        score -= 10;
        issues.push(`Low completion rate: ${Math.round(completionRate)}%`);
        recommendations.push('Break down large tasks into smaller ones');
      }
      
      // Penalize for too many tasks
      if (backlogTasks.length > 30) {
        score -= 10;
        issues.push(`Large backlog: ${backlogTasks.length} tasks`);
        recommendations.push('Prioritize and defer non-essential tasks');
      }
      
      // Determine status
      let status: 'healthy' | 'warning' | 'critical';
      if (score >= 80) status = 'healthy';
      else if (score >= 60) status = 'warning';
      else status = 'critical';
      
      // Add positive feedback
      if (issues.length === 0) {
        recommendations.push('Great job keeping your backlog clean!');
      }
      
      const health: BacklogHealth = {
        score: Math.max(0, score),
        status,
        metrics: {
          totalTasks: backlogTasks.length,
          staleTasks,
          criticalTasks,
          avgAge: Math.round(avgAge * 10) / 10,
          growthRate,
          completionRate: Math.round(completionRate),
        },
        issues,
        recommendations,
      };
      
      // Get oldest tasks if details requested
      const oldestTasks = includeDetails 
        ? backlogTasks
            .sort((a, b) => {
              const aDate = new Date(a.createdAt || now).getTime();
              const bDate = new Date(b.createdAt || now).getTime();
              return aDate - bDate;
            })
            .slice(0, 5)
            .map(task => ({
              id: task.id,
              title: task.title,
              age: differenceInDays(now, new Date(task.createdAt || now)),
              priority: task.priority,
            }))
        : [];
      
      return buildToolResponse(
        toolOptions,
        {
          health,
          oldestTasks: includeDetails ? oldestTasks : undefined,
        },
        {
          type: 'card',
          title: 'Backlog Health Report',
          description: `Score: ${health.score}/100 - ${status.toUpperCase()}`,
          priority: status === 'critical' ? 'high' : status === 'warning' ? 'medium' : 'low',
          components: [
            {
              type: 'progressIndicator',
              data: {
                current: health.score,
                total: 100,
                label: 'Health Score',
                percentage: health.score,
              },
            },
          ],
        },
        {
          suggestions: recommendations,
          notification: {
            show: true,
            type: status === 'healthy' ? 'success' : status === 'warning' ? 'warning' : 'error',
            message: `Backlog ${status}: ${health.metrics.totalTasks} tasks, avg age ${health.metrics.avgAge} days`,
            duration: 4000,
          },
          actions: status !== 'healthy' ? [{
            id: 'clean-backlog',
            label: 'Clean Up Backlog',
            variant: 'primary',
            action: {
              type: 'message',
              message: 'Help me clean up my task backlog',
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[GET TASK BACKLOG HEALTH] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Health Check Failed',
          description: 'Could not analyze backlog health.',
        }
      );
    }
  },
}); 