import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';

interface TaskPattern {
  completionVelocity: {
    daily: number;
    weekly: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  preferredTimes: {
    hour: number;
    count: number;
    percentage: number;
  }[];
  taskTypes: {
    type: string;
    count: number;
    avgDuration: number;
    completionRate: number;
  }[];
  productivityInsights: {
    mostProductiveDay: string;
    mostProductiveHour: number;
    avgTaskDuration: number;
    overestimationFactor: number;
  };
}

export const analyzeTaskPatterns = tool({
  description: 'Analyze historical task completion patterns to understand work habits and productivity',
  parameters: z.object({
    days: z.number().optional().default(30).describe('Number of days to analyze'),
    includeIncomplete: z.boolean().optional().default(false).describe('Include incomplete tasks in analysis'),
  }),
  execute: async ({ days, includeIncomplete }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'analyzeTaskPatterns',
      operation: 'read' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Define date range
      const endDate = new Date();
      const startDate = subDays(endDate, days);
      
      // Fetch completed tasks in date range
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      if (!includeIncomplete) {
        query = query.eq('status', 'completed');
      }
      
      const { data: tasks, error } = await query;
      
      if (error) throw error;
      if (!tasks || tasks.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            patterns: null,
            message: `No tasks found in the last ${days} days`,
          },
          {
            type: 'card',
            title: 'No Task History',
            description: `No completed tasks found in the last ${days} days to analyze`,
            priority: 'low',
            components: [],
          },
          {
            suggestions: ['Create and complete some tasks first', 'Try a longer time range'],
          }
        );
      }
      
      // Calculate completion velocity
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const dailyAvg = completedTasks.length / days;
      const weeklyAvg = dailyAvg * 7;
      
      // Calculate trend (compare first half vs second half)
      const midPoint = Math.floor(days / 2);
      const firstHalfDate = subDays(endDate, midPoint);
      const firstHalfCount = completedTasks.filter(t => {
        const createdAt = t.created_at ? new Date(t.created_at) : new Date();
        return createdAt < firstHalfDate;
      }).length;
      const secondHalfCount = completedTasks.length - firstHalfCount;
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      const changeRatio = secondHalfCount / (firstHalfCount || 1);
      if (changeRatio > 1.2) trend = 'increasing';
      else if (changeRatio < 0.8) trend = 'decreasing';
      
      // Analyze completion times (using updated_at as proxy for completion time)
      const hourCounts = new Map<number, number>();
      const dayOfWeekCounts = new Map<string, number>();
      
      completedTasks.forEach(task => {
        // Use updated_at as proxy for completion time
        const dateStr = task.updated_at || task.created_at;
        if (dateStr) {
          const completedDate = new Date(dateStr);
          const hour = completedDate.getHours();
          const dayOfWeek = format(completedDate, 'EEEE');
          
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
          dayOfWeekCounts.set(dayOfWeek, (dayOfWeekCounts.get(dayOfWeek) || 0) + 1);
        }
      });
      
      // Get preferred times
      const preferredTimes = Array.from(hourCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hour, count]) => ({
          hour,
          count,
          percentage: Math.round((count / completedTasks.length) * 100),
        }));
      
      // Find most productive day
      const mostProductiveDay = Array.from(dayOfWeekCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
      
      const mostProductiveHour = preferredTimes[0]?.hour || 0;
      
      // Analyze task types by tags/priority
      const typeStats = new Map<string, { count: number; totalDuration: number; completed: number }>();
      
      tasks.forEach(task => {
        const type = task.priority || 'medium';
        const stats = typeStats.get(type) || { count: 0, totalDuration: 0, completed: 0 };
        stats.count++;
        stats.totalDuration += task.estimated_minutes || 30;
        if (task.status === 'completed') stats.completed++;
        typeStats.set(type, stats);
      });
      
      const taskTypes = Array.from(typeStats.entries()).map(([type, stats]) => ({
        type,
        count: stats.count,
        avgDuration: Math.round(stats.totalDuration / stats.count),
        completionRate: Math.round((stats.completed / stats.count) * 100),
      }));
      
      // Calculate average duration and overestimation
      const avgTaskDuration = tasks.reduce((sum, task) => 
        sum + (task.estimated_minutes || 30), 0
      ) / tasks.length;
      
      // For overestimation, we'd need actual vs estimated, but for now assume 20% overestimation
      const overestimationFactor = 1.2;
      
      const patterns: TaskPattern = {
        completionVelocity: {
          daily: Math.round(dailyAvg * 10) / 10,
          weekly: Math.round(weeklyAvg * 10) / 10,
          trend,
        },
        preferredTimes,
        taskTypes,
        productivityInsights: {
          mostProductiveDay,
          mostProductiveHour,
          avgTaskDuration: Math.round(avgTaskDuration),
          overestimationFactor,
        },
      };
      
      return buildToolResponse(
        toolOptions,
        { patterns },
        {
          type: 'card',
          title: 'Task Pattern Analysis',
          description: `Analyzed ${tasks.length} tasks over ${days} days`,
          priority: 'medium',
          components: [
            {
              type: 'progressIndicator',
              data: {
                current: completedTasks.length,
                total: tasks.length,
                label: 'Completion Rate',
                percentage: Math.round((completedTasks.length / tasks.length) * 100),
              },
            },
          ],
        },
        {
          suggestions: [
            `Schedule important tasks at ${mostProductiveHour}:00`,
            trend === 'decreasing' ? 'Your productivity is declining - consider a break' : null,
            `Plan heavy work for ${mostProductiveDay}s`,
            overestimationFactor > 1.3 ? 'You tend to overestimate - add buffer time' : null,
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: 'info',
            message: `Completing ${patterns.completionVelocity.daily} tasks per day on average`,
            duration: 3000,
          },
        }
      );
      
    } catch (error) {
      console.error('[ANALYZE TASK PATTERNS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Analysis Failed',
          description: 'Could not analyze task patterns.',
        }
      );
    }
  },
}); 