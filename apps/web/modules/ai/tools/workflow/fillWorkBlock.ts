import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { getCurrentUserId } from '../utils/helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { type WorkflowFillWorkBlockResponse } from '../types/responses';

const parameters = z.object({
  blockId: z.string().describe("ID of the work block to fill"),
  blockDuration: z.number().describe("Minutes available in the block"),
  blockTime: z.enum(["morning", "afternoon", "evening"]).optional().describe("Time of day for context")
});

export const fillWorkBlock = registerTool(
  createTool<typeof parameters, WorkflowFillWorkBlockResponse>({
    name: 'workflow_fillWorkBlock',
    description: "Determine which tasks should go into a specific work block based on duration and priority",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Fill Work Block',
      requiresConfirmation: false,
      supportsStreaming: true,
    },
    execute: async ({ blockId, blockDuration, blockTime }) => {
      try {
        const userId = await getCurrentUserId();
        const factory = ServiceFactory.getInstance();
        const taskService = factory.getTaskService();
        
        // Get task backlog
        const backlogTasks = await taskService.getTaskBacklog();
        
        // Filter to only active tasks with estimates
        const eligibleTasks = backlogTasks.filter((task: any) => 
          task.status === 'active' && 
          task.estimatedMinutes && 
          task.estimatedMinutes > 0 &&
          task.estimatedMinutes <= blockDuration // Task must fit in block
        );
        
        // Simple scoring: priority (0-60) + age (0-40)
        const scoredTasks = eligibleTasks.map((task: any) => {
          let score = 0;
          
          // Priority scoring (60% of score)
          if (task.priority === 'high') score += 60;
          else if (task.priority === 'medium') score += 30;
          else score += 10;
          
          // Age scoring (40% of score) - older tasks get higher scores
          const daysInBacklog = task.daysInBacklog || 0;
          const ageScore = Math.min(40, daysInBacklog * 4); // Max 40 points, 4 points per day
          score += ageScore;
          
          // Generate reason
          let reason = '';
          if (task.priority === 'high') {
            reason = 'High priority';
          } else if (daysInBacklog > 5) {
            reason = `In backlog for ${daysInBacklog} days`;
          } else if (task.estimatedMinutes <= 30) {
            reason = 'Quick win task';
          } else {
            reason = 'Fits time slot well';
          }
          
          return {
            id: task.id,
            title: task.title,
            estimatedMinutes: task.estimatedMinutes,
            priority: task.priority,
            score,
            reason
          };
        });
        
        // Sort by score descending
        scoredTasks.sort((a, b) => b.score - a.score);
        
        // Select tasks that fit in the block
        const selectedTasks: typeof scoredTasks = [];
        let remainingMinutes = blockDuration;
        
        for (const task of scoredTasks) {
          if (task.estimatedMinutes <= remainingMinutes) {
            selectedTasks.push(task);
            remainingMinutes -= task.estimatedMinutes;
            
            // Stop if we've filled 80% of the block (leave some buffer)
            if (remainingMinutes <= blockDuration * 0.2) {
              break;
            }
          }
        }
        
        // If no tasks fit perfectly, try to find a single task that's close
        if (selectedTasks.length === 0 && scoredTasks.length > 0) {
          // Find task closest to block duration
          const closestTask = scoredTasks.reduce((prev, curr) => {
            const prevDiff = Math.abs(prev.estimatedMinutes - blockDuration);
            const currDiff = Math.abs(curr.estimatedMinutes - blockDuration);
            return currDiff < prevDiff ? curr : prev;
          });
          
          if (closestTask.estimatedMinutes <= blockDuration * 1.2) { // Allow 20% overflow
            selectedTasks.push({
              ...closestTask,
              reason: 'Best fit for time available'
            });
          }
        }
        
        // Calculate total minutes and fit quality
        const totalMinutes = selectedTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
        let fitQuality: 'perfect' | 'good' | 'acceptable';
        
        const utilization = totalMinutes / blockDuration;
        if (utilization >= 0.9 && utilization <= 1.0) {
          fitQuality = 'perfect';
        } else if (utilization >= 0.7) {
          fitQuality = 'good';
        } else {
          fitQuality = 'acceptable';
        }
        
        return {
          success: true,
          blockId,
          tasks: selectedTasks,
          totalMinutes,
          fitQuality
        };
        
      } catch (error) {
        console.error('[Workflow: fillWorkBlock] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fill work block',
          blockId,
          tasks: [],
          totalMinutes: 0,
          fitQuality: 'acceptable'
        };
      }
    },
  })
); 