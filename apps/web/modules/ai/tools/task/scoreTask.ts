import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';

interface TaskScore {
  overall: number; // 0-100
  factors: {
    urgency: number; // 0-10
    importance: number; // 0-10
    effort: number; // 0-10 (inverse - lower effort = higher score)
    impact: number; // 0-10
    alignment: number; // 0-10 (with user preferences)
  };
  reasoning: {
    urgency: string;
    importance: string;
    effort: string;
    impact: string;
    alignment: string;
  };
}

export const scoreTask = tool({
  description: 'Calculate a multi-factor score for a task based on urgency, importance, effort, and impact',
  parameters: z.object({
    taskId: z.string().optional().describe('ID of existing task to score'),
    taskDetails: z.object({
      title: z.string(),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      estimatedMinutes: z.number().optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
      tags: z.array(z.string()).optional(),
    }).optional().describe('Details for a new task to score'),
  }),
  execute: async ({ taskId, taskDetails }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'scoreTask',
      operation: 'execute' as const,
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
      
      // Get user preferences for scoring weights
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      // Default scoring weights - we'll store these in a jsonb column later
      const scoringWeights = {
        urgency: 0.3,
        importance: 0.3,
        effort: 0.2,
        impact: 0.2,
      };
      
      // Get task details
      let task: any;
      if (taskId) {
        task = await taskService.getTask(taskId);
        if (!task) throw new Error('Task not found');
      } else if (taskDetails) {
        task = taskDetails;
      } else {
        throw new Error('Either taskId or taskDetails must be provided');
      }
      
      // Calculate individual scores
      const scores = calculateTaskScores(task, preferences || {});
      
      // Calculate weighted overall score
      const overall = Math.round(
        scores.factors.urgency * scoringWeights.urgency +
        scores.factors.importance * scoringWeights.importance +
        scores.factors.effort * scoringWeights.effort +
        scores.factors.impact * scoringWeights.impact
      );
      
      scores.overall = Math.min(100, Math.max(0, overall * 10)); // Convert to 0-100
      
      // For now, we don't persist the score since the task table doesn't have a score column
      // This could be added to task metadata in the future
      
      return buildToolResponse(
        toolOptions,
        {
          taskId: taskId || null,
          task: {
            title: task.title,
            description: task.description,
            priority: task.priority,
          },
          score: scores,
        },
        {
          type: 'card',
          title: 'Task Score Calculated',
          description: `${task.title} scored ${scores.overall}/100`,
          priority: scores.overall > 70 ? 'high' : scores.overall > 40 ? 'medium' : 'low',
          components: [
            {
              type: 'progressIndicator',
              data: {
                current: scores.overall,
                total: 100,
                label: 'Overall Score',
                percentage: scores.overall,
              },
            },
          ],
        },
        {
          suggestions: [
            scores.overall > 70 ? 'Schedule this task in your next focus block' : null,
            scores.factors.effort > 7 ? 'Break this task into smaller subtasks' : null,
            scores.factors.urgency > 8 ? 'Prioritize this task today' : null,
            'View scoring breakdown',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: 'success',
            message: `Task scored: ${scores.overall}/100`,
            duration: 3000,
          },
        }
      );
      
    } catch (error) {
      console.error('[SCORE TASK] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Scoring Failed',
          description: 'Could not calculate task score.',
        }
      );
    }
  },
});

function calculateTaskScores(task: any, preferences: any): TaskScore {
  const now = new Date();
  
  // Urgency calculation
  let urgencyScore = 5; // Default medium urgency
  let urgencyReason = 'No due date specified';
  
  if (task.dueDate) {
    const dueDate = new Date(task.dueDate);
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilDue < 0) {
      urgencyScore = 10;
      urgencyReason = 'Overdue task';
    } else if (hoursUntilDue < 24) {
      urgencyScore = 9;
      urgencyReason = 'Due within 24 hours';
    } else if (hoursUntilDue < 72) {
      urgencyScore = 7;
      urgencyReason = 'Due within 3 days';
    } else if (hoursUntilDue < 168) {
      urgencyScore = 5;
      urgencyReason = 'Due within a week';
    } else {
      urgencyScore = 3;
      urgencyReason = 'Due date is far out';
    }
  }
  
  // Importance calculation
  let importanceScore = 5;
  let importanceReason = 'Standard priority task';
  
  if (task.priority === 'high') {
    importanceScore = 8;
    importanceReason = 'High priority task';
  } else if (task.priority === 'low') {
    importanceScore = 3;
    importanceReason = 'Low priority task';
  }
  
  // Boost importance for certain keywords
  const importantKeywords = ['critical', 'urgent', 'important', 'deadline', 'client', 'meeting'];
  const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
  
  if (importantKeywords.some(keyword => taskText.includes(keyword))) {
    importanceScore = Math.min(10, importanceScore + 2);
    importanceReason += ' (contains important keywords)';
  }
  
  // Effort calculation (inverse - lower effort = higher score)
  let effortScore = 5;
  let effortReason = 'Unknown effort required';
  
  if (task.estimatedMinutes) {
    if (task.estimatedMinutes <= 15) {
      effortScore = 9;
      effortReason = 'Quick task (≤15 min)';
    } else if (task.estimatedMinutes <= 30) {
      effortScore = 7;
      effortReason = 'Short task (≤30 min)';
    } else if (task.estimatedMinutes <= 60) {
      effortScore = 5;
      effortReason = 'Medium task (≤1 hour)';
    } else if (task.estimatedMinutes <= 120) {
      effortScore = 3;
      effortReason = 'Long task (≤2 hours)';
    } else {
      effortScore = 1;
      effortReason = 'Very long task (>2 hours)';
    }
  }
  
  // Impact calculation
  let impactScore = 5;
  let impactReason = 'Standard impact task';
  
  // Check for high-impact keywords
  const impactKeywords = ['milestone', 'launch', 'release', 'presentation', 'review', 'decision'];
  if (impactKeywords.some(keyword => taskText.includes(keyword))) {
    impactScore = 8;
    impactReason = 'High impact task';
  }
  
  // Alignment with preferences
  let alignmentScore = 5;
  let alignmentReason = 'Neutral alignment with preferences';
  
  // Check if task aligns with preferred working hours
  if (preferences.work_start_time && preferences.work_end_time && task.estimatedMinutes <= 60) {
    alignmentScore = 7;
    alignmentReason = 'Fits well within preferred working hours';
  }
  
  // Check if task matches deep work preference
  if (preferences.deep_work_preference && task.estimatedMinutes >= 60) {
    if (preferences.deep_work_preference === 'morning' && task.tags?.includes('deep-work')) {
      alignmentScore = 8;
      alignmentReason = 'Matches morning deep work preference';
    } else if (preferences.deep_work_preference === 'afternoon' && task.tags?.includes('deep-work')) {
      alignmentScore = 8;
      alignmentReason = 'Matches afternoon deep work preference';
    }
  }
  
  return {
    overall: 0, // Will be calculated by weighted average
    factors: {
      urgency: urgencyScore,
      importance: importanceScore,
      effort: effortScore,
      impact: impactScore,
      alignment: alignmentScore,
    },
    reasoning: {
      urgency: urgencyReason,
      importance: importanceReason,
      effort: effortReason,
      impact: impactReason,
      alignment: alignmentReason,
    },
  };
} 