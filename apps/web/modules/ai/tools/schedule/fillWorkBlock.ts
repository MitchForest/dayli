import { z } from 'zod';
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type FillWorkBlockResponse } from '../types/responses';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';

// Simple task scoring function
function calculateTaskScore(task: any): number {
  let score = 50; // Base score
  
  // Priority scoring
  if (task.priority === 'high') score += 30;
  else if (task.priority === 'medium') score += 15;
  
  // Urgency scoring (if task has been in backlog for a while)
  const daysInBacklog = Math.floor((Date.now() - new Date(task.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
  score += Math.min(daysInBacklog * 2, 20); // Max 20 points for age
  
  return score;
}

export const fillWorkBlock = registerTool(
  createTool<typeof parameters, FillWorkBlockResponse>({
    name: 'schedule_fillWorkBlock',
    description: 'Intelligently fill a work block with high-priority tasks from backlog',
    parameters: z.object({
      blockId: z.string().describe('ID of the work block to fill'),
      strategy: z.enum(['priority', 'quick_wins', 'energy_match']).default('priority'),
      maxTasks: z.number().default(5),
    }),
    metadata: {
      category: 'schedule',
      displayName: 'Fill Work Block',
      requiresConfirmation: false,
      supportsStreaming: false,
    },
    execute: async ({ blockId, strategy, maxTasks }) => {
      const userId = await getCurrentUserId();
      const factory = ServiceFactory.getInstance();
      const scheduleService = factory.getScheduleService();
      const taskService = factory.getTaskService();
      
      // Get the block details
      const block = await scheduleService.getTimeBlock(blockId);
      if (!block || block.type !== 'work') {
        return {
          success: false,
          error: 'Invalid work block',
          blockId,
          assignedTasks: [],
          utilization: 0,
          remainingMinutes: 0,
        };
      }
      
      // Calculate available time
      const blockDuration = Math.floor(
        (block.endTime.getTime() - block.startTime.getTime()) / (1000 * 60)
      );
      
      // Get tasks from backlog
      const tasks = await taskService.getTaskBacklog();
      
      // Add basic scoring to tasks
      const tasksWithScores = tasks.map(task => ({
        ...task,
        score: calculateTaskScore(task),
      }));
      
      // Apply strategy
      let selectedTasks: any[] = [];
      let remainingMinutes = blockDuration;
      
      switch (strategy) {
        case 'priority':
          // Sort by score descending
          tasksWithScores.sort((a: any, b: any) => b.score - a.score);
          break;
          
        case 'quick_wins':
          // Prefer short, high-impact tasks
          tasksWithScores.sort((a: any, b: any) => {
            const aRatio = a.score / (a.estimatedMinutes || 30);
            const bRatio = b.score / (b.estimatedMinutes || 30);
            return bRatio - aRatio;
          });
          break;
          
        case 'energy_match':
          // Match task complexity to block time
          const blockStartDate = new Date(block.startTime);
          const isHighEnergy = blockStartDate.getHours() < 12;
          tasksWithScores.sort((a: any, b: any) => {
            if (isHighEnergy) {
              // Morning: prefer complex tasks
              return (b.estimatedMinutes || 30) - (a.estimatedMinutes || 30);
            } else {
              // Afternoon: prefer simpler tasks
              return (a.estimatedMinutes || 30) - (b.estimatedMinutes || 30);
            }
          });
          break;
      }
      
      // Select tasks that fit
      for (const task of tasksWithScores) {
        if (selectedTasks.length >= maxTasks) break;
        
        const taskDuration = task.estimatedMinutes || 30;
        if (taskDuration <= remainingMinutes) {
          selectedTasks.push(task);
          remainingMinutes -= taskDuration;
        }
      }
      
      // Update task status
      for (const task of selectedTasks) {
        await taskService.updateTask(task.id, {
          status: 'scheduled',
        });
      }
      
      // Calculate utilization
      const utilization = Math.round(((blockDuration - remainingMinutes) / blockDuration) * 100);
      
      console.log(`[Tool: fillWorkBlock] Filled block ${blockId} with ${selectedTasks.length} tasks (${utilization}% utilization)`);
      
      // Return pure data
      return {
        success: true,
        blockId,
        assignedTasks: selectedTasks.map(t => ({
          id: t.id,
          title: t.title,
          estimatedMinutes: t.estimatedMinutes || 30,
          priority: t.priority,
          score: t.score,
        })),
        utilization,
        remainingMinutes,
      };
    },
  })
);

const parameters = z.object({
  blockId: z.string().describe('ID of the work block to fill'),
  strategy: z.enum(['priority', 'quick_wins', 'energy_match']).default('priority'),
  maxTasks: z.number().default(5),
});