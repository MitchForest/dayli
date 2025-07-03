import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type SuggestForDurationResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';

const parameters = z.object({
  duration: z.number().min(15).describe('Available time in minutes'),
  strategy: z.enum(['priority', 'quick_wins', 'mixed']).describe('Strategy for task selection'),
});

// Helper function
function getReasoningForStrategy(strategy: 'priority' | 'quick_wins' | 'mixed', type: 'single' | 'multiple'): string {
  const reasonings = {
    priority: {
      single: 'Highest priority task that fits the time slot',
      multiple: 'High priority tasks to maximize impact',
    },
    quick_wins: {
      single: 'Quick task to complete and build momentum',
      multiple: 'Multiple quick completions for productivity boost',
    },
    mixed: {
      single: 'Best balance of priority and time fit',
      multiple: 'Balanced mix of priority and efficient time use',
    },
  };
  
  return reasonings[strategy][type];
}

export const suggestForDuration = registerTool(
  createTool<typeof parameters, SuggestForDurationResponse>({
    name: 'task_suggestForDuration',
    description: 'Get task suggestions that fit within a specific time duration',
    parameters,
    metadata: {
      category: 'task',
      displayName: 'Suggest Tasks for Duration',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ duration, strategy }) => {
      try {
        const taskService = ServiceFactory.getInstance().getTaskService();
        
        // Get all available tasks
        const tasks = await taskService.getTaskBacklog();
        
        // Filter tasks that could fit in the duration
        const eligibleTasks = tasks.filter(task => {
          const estimatedMinutes = task.estimatedMinutes || 30;
          return estimatedMinutes <= duration && task.status !== 'completed';
        });
        
        // Score tasks based on strategy
        const scoredTasks = eligibleTasks.map(task => {
          let score = 0;
          const estimatedMinutes = task.estimatedMinutes || 30;
          
          switch (strategy) {
            case 'priority':
              // Focus on high priority tasks
              if (task.priority === 'high') score += 100;
              else if (task.priority === 'medium') score += 50;
              else score += 10;
              break;
              
            case 'quick_wins':
              // Prefer shorter tasks to maximize completions
              score = 100 - (estimatedMinutes / duration * 50);
              // Small bonus for priority
              if (task.priority === 'high') score += 20;
              else if (task.priority === 'medium') score += 10;
              break;
              
            case 'mixed':
              // Balance priority and duration fit
              if (task.priority === 'high') score += 50;
              else if (task.priority === 'medium') score += 30;
              else score += 10;
              
              // Bonus for good duration fit (tasks that use 60-90% of available time)
              const utilizationRatio = estimatedMinutes / duration;
              if (utilizationRatio >= 0.6 && utilizationRatio <= 0.9) {
                score += 30;
              } else if (utilizationRatio >= 0.4) {
                score += 20;
              }
              break;
          }
          
          return { task, score };
        });
        
        // Sort by score
        scoredTasks.sort((a, b) => b.score - a.score);
        
        // Generate combinations
        const suggestions: Array<{
          combination: Array<{
            id: string;
            title: string;
            estimatedMinutes: number;
            priority: 'low' | 'medium' | 'high';
          }>;
          totalMinutes: number;
          totalScore: number;
          reasoning: string;
        }> = [];
        
        // Strategy 1: Single best task
        if (scoredTasks.length > 0) {
          const bestTask = scoredTasks[0];
          if (bestTask) {
            suggestions.push({
              combination: [{
                id: bestTask.task.id,
                title: bestTask.task.title,
                estimatedMinutes: bestTask.task.estimatedMinutes || 30,
                priority: bestTask.task.priority,
              }],
              totalMinutes: bestTask.task.estimatedMinutes || 30,
              totalScore: bestTask.score,
              reasoning: getReasoningForStrategy(strategy, 'single'),
            });
          }
        }
        
        // Strategy 2: Multiple tasks that fit
        if (duration >= 30) {
          const combination: typeof suggestions[0]['combination'] = [];
          let remainingTime = duration;
          let totalScore = 0;
          
          for (const { task, score } of scoredTasks) {
            const taskDuration = task.estimatedMinutes || 30;
            if (taskDuration <= remainingTime) {
              combination.push({
                id: task.id,
                title: task.title,
                estimatedMinutes: taskDuration,
                priority: task.priority,
              });
              remainingTime -= taskDuration;
              totalScore += score;
              
              // Stop if we've filled 80% of the time or have 3+ tasks
              if (remainingTime < duration * 0.2 || combination.length >= 3) {
                break;
              }
            }
          }
          
          if (combination.length > 1) {
            const totalMinutes = combination.reduce((sum, t) => sum + t.estimatedMinutes, 0);
            suggestions.push({
              combination,
              totalMinutes,
              totalScore,
              reasoning: getReasoningForStrategy(strategy, 'multiple'),
            });
          }
        }
        
        // Strategy 3: Quick wins (multiple short tasks)
        if (strategy === 'quick_wins' || strategy === 'mixed') {
          const shortTasks = scoredTasks
            .filter(({ task }) => (task.estimatedMinutes || 30) <= 30)
            .slice(0, 5);
          
          if (shortTasks.length >= 2) {
            const quickWinCombination: typeof suggestions[0]['combination'] = [];
            let quickWinTime = 0;
            let quickWinScore = 0;
            
            for (const { task, score } of shortTasks) {
              const taskDuration = task.estimatedMinutes || 30;
              if (quickWinTime + taskDuration <= duration) {
                quickWinCombination.push({
                  id: task.id,
                  title: task.title,
                  estimatedMinutes: taskDuration,
                  priority: task.priority,
                });
                quickWinTime += taskDuration;
                quickWinScore += score;
              }
            }
            
            if (quickWinCombination.length >= 2) {
              suggestions.push({
                combination: quickWinCombination,
                totalMinutes: quickWinTime,
                totalScore: quickWinScore,
                reasoning: 'Multiple quick tasks to build momentum',
              });
            }
          }
        }
        
        // Sort suggestions by score
        suggestions.sort((a, b) => b.totalScore - a.totalScore);
        
        console.log(`[Tool: suggestForDuration] Generated ${suggestions.length} suggestions for ${duration} minutes using ${strategy} strategy`);
        
        return {
          success: true,
          suggestions: suggestions.slice(0, 3), // Return top 3 suggestions
          availableDuration: duration,
          totalTasksConsidered: eligibleTasks.length,
        };
        
      } catch (error) {
        console.error('[Tool: suggestForDuration] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to suggest tasks',
          suggestions: [],
          availableDuration: duration,
          totalTasksConsidered: 0,
        };
      }
    },
  })
); 