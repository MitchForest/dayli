import { tool } from 'ai';
import { z } from 'zod';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';
import { type UniversalToolResponse } from '../../schemas/universal.schema';

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
      
      // Get tasks with scores
      const tasks = await taskService.getTasksWithScores({
        status: ['active', 'backlog'],
        userId,
      });
      
      // Apply strategy
      let selectedTasks = [];
      let remainingMinutes = blockDuration;
      
      switch (strategy) {
        case 'priority':
          // Sort by score descending
          tasks.sort((a, b) => b.score - a.score);
          break;
          
        case 'quick_wins':
          // Prefer short, high-impact tasks
          tasks.sort((a, b) => {
            const aRatio = a.score / (a.estimatedMinutes || 30);
            const bRatio = b.score / (b.estimatedMinutes || 30);
            return bRatio - aRatio;
          });
          break;
          
        case 'energy_match':
          // Match task complexity to block time
          const isHighEnergy = block.startTime.getHours() < 12;
          tasks.sort((a, b) => {
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
      for (const task of tasks) {
        if (selectedTasks.length >= maxTasks) break;
        
        const taskDuration = task.estimatedMinutes || 30;
        if (taskDuration <= remainingMinutes) {
          selectedTasks.push(task);
          remainingMinutes -= taskDuration;
        }
      }
      
      // Assign tasks to block
      const assignedTaskIds = selectedTasks.map(t => t.id);
      await scheduleService.updateTimeBlock(blockId, {
        assigned_tasks: assignedTaskIds,
      });
      
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
                ...block,
                tasks: selectedTasks.map(t => ({
                  id: t.id,
                  title: t.title,
                  estimatedMinutes: t.estimatedMinutes || 30,
                  completed: false,
                })),
              },
            },
            {
              type: 'taskList',
              data: {
                tasks: selectedTasks,
                showScore: true,
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
          ].filter(Boolean),
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