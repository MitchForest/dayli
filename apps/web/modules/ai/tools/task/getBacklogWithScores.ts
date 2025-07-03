import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type GetBacklogWithScoresResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { differenceInDays } from 'date-fns';

const parameters = z.object({
  minScore: z.number().min(0).max(100).optional().describe('Minimum score threshold'),
  maxDuration: z.number().min(0).optional().describe('Maximum duration in minutes'),
  includeCompleted: z.boolean().optional().default(false).describe('Include completed tasks'),
});

export const getBacklogWithScores = registerTool(
  createTool<typeof parameters, GetBacklogWithScoresResponse>({
    name: 'task_getBacklogWithScores',
    description: 'Get task backlog with pre-calculated priority scores',
    parameters,
    metadata: {
      category: 'task',
      displayName: 'Get Scored Task Backlog',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ minScore, maxDuration, includeCompleted }) => {
      try {
        const taskService = ServiceFactory.getInstance().getTaskService();
        
        // Get task backlog
        const tasks = await taskService.getTaskBacklog();
        
        // Filter and score tasks
        const scoredTasks = tasks
          .filter(task => {
            // Filter by completion status
            if (!includeCompleted && task.status === 'completed') {
              return false;
            }
            
            // Filter by duration
            if (maxDuration && task.estimatedMinutes && task.estimatedMinutes > maxDuration) {
              return false;
            }
            
            return true;
          })
          .map(task => {
            // Calculate priority score (0-100)
            let priorityScore = 0;
            
            // Base priority mapping (low=10, medium=30, high=50)
            switch (task.priority) {
              case 'high':
                priorityScore = 50;
                break;
              case 'medium':
                priorityScore = 30;
                break;
              case 'low':
                priorityScore = 10;
                break;
              default:
                priorityScore = 20;
            }
            
            // Age score (up to 20 points)
            // Each day in backlog adds 2 points, max 20
            const daysInBacklog = 0; // Will be calculated from createdAt
            const ageScore = Math.min(daysInBacklog * 2, 20);
            
            // Urgency score (up to 10 points)
            // Since we don't have dueDate, we'll use days since creation
            let urgencyScore = 0;
            if (task.createdAt) {
              const daysSinceCreation = differenceInDays(new Date(), new Date(task.createdAt));
              if (daysSinceCreation >= 14) {
                urgencyScore = 10; // Very old
              } else if (daysSinceCreation >= 7) {
                urgencyScore = 7; // Old
              } else if (daysSinceCreation >= 3) {
                urgencyScore = 4; // Getting old
              } else if (daysSinceCreation >= 1) {
                urgencyScore = 2; // Recent
              }
            }
            
            // Calculate total score
            const totalScore = Math.min(priorityScore + ageScore + urgencyScore, 100);
            
            return {
              id: task.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: task.status,
              estimatedMinutes: task.estimatedMinutes || 30,
              dueDate: undefined,
              daysInBacklog: daysInBacklog,
              score: totalScore,
              scoreBreakdown: {
                priority: priorityScore,
                age: ageScore,
                urgency: urgencyScore,
              },
            };
          })
          .filter(task => {
            // Apply minimum score filter
            if (minScore !== undefined && task.score < minScore) {
              return false;
            }
            return true;
          })
          .sort((a, b) => b.score - a.score); // Sort by score descending
        
        console.log(`[Tool: getBacklogWithScores] Found ${scoredTasks.length} tasks, scores ${scoredTasks[0]?.score || 0}-${scoredTasks[scoredTasks.length - 1]?.score || 0}`);
        
        return {
          success: true,
          tasks: scoredTasks,
          totalTasks: scoredTasks.length,
          averageScore: scoredTasks.length > 0 
            ? Math.round(scoredTasks.reduce((sum, t) => sum + t.score, 0) / scoredTasks.length)
            : 0,
        };
        
      } catch (error) {
        console.error('[Tool: getBacklogWithScores] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get task backlog',
          tasks: [],
          totalTasks: 0,
          averageScore: 0,
        };
      }
    },
  })
); 