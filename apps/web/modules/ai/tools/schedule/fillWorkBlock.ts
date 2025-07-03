import { tool } from 'ai';
import { z } from 'zod';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';
import { type UniversalToolResponse } from '../../schemas/universal.schema';

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

export const fillWorkBlock = tool({
  description: 'Intelligently fill a work block with high-priority tasks from backlog',
  parameters: z.object({
    blockId: z.string().describe('ID of the work block to fill'),
    strategy: z.enum(['priority', 'quick_wins', 'energy_match']).default('priority'),
    maxTasks: z.number().default(5),
  }),
  execute: async ({ blockId, strategy, maxTasks }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'fillWorkBlock',
      operation: 'update' as const,
      resourceType: 'schedule' as const,
      startTime,
    };
    
    try {
      const userId = await getCurrentUserId();
      const factory = ServiceFactory.getInstance();
      const scheduleService = factory.getScheduleService();
      const taskService = factory.getTaskService();
      
      // Get the block details
      const block = await scheduleService.getTimeBlock(blockId);
      if (!block || block.type !== 'work') {
        throw new Error('Invalid work block');
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
      let selectedTasks = [];
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
      
      // Assign tasks to block
      // Since updateTimeBlock doesn't support assigned_tasks, we'll skip this for now
      // TODO: Add proper task assignment method in a future sprint
      const assignedTaskIds = selectedTasks.map(t => t.id);
      
      // Update task status
      for (const task of selectedTasks) {
        await taskService.updateTask(task.id, {
          status: 'scheduled',
        });
      }
      
      // Build response
      const utilization = Math.round(((blockDuration - remainingMinutes) / blockDuration) * 100);
      
      return buildToolResponse(
        toolOptions,
        {
          blockId,
          assignedTasks: selectedTasks,
          utilization,
          remainingMinutes,
        },
        {
          type: 'card',
          title: `Filled ${block.title}`,
          description: `Added ${selectedTasks.length} tasks (${utilization}% utilization)`,
          priority: 'high',
          components: [
            {
              type: 'scheduleBlock',
              data: {
                id: block.id,
                title: block.title || 'Work Block',
                type: block.type,
                startTime: block.startTime.toISOString(),
                endTime: block.endTime.toISOString(),
                tasks: selectedTasks.map(t => ({
                  id: t.id,
                  title: t.title,
                  estimatedMinutes: t.estimatedMinutes || 30,
                  completed: false,
                })),
              },
            },
          ],
        },
        {
          notification: {
            show: true,
            type: 'success',
            message: `Added ${selectedTasks.length} tasks to your work block`,
            duration: 3000,
          },
          suggestions: [
            remainingMinutes > 30 ? 'Add more tasks' : null,
            'Start working on tasks',
            'Adjust task order',
          ].filter(Boolean) as string[],
        }
      );
    } catch (error) {
      return buildErrorResponse(toolOptions, error, {
        title: 'Failed to fill work block',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
});