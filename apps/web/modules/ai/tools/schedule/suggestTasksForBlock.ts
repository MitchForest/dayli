import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError, TimeBlock } from '../types';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ServiceFactory } from '@/services/factory/service.factory';
import { ensureServicesConfigured } from '../utils/auth';
import { format, parseISO } from 'date-fns';
import { getUnassignedTasks } from './getUnassignedTasks';

interface TaskWithScore {
  id: string;
  title: string;
  description?: string;
  priority: number;
  urgency: number;
  estimatedMinutes: number;
  source: string;
  createdAt: string;
  daysInBacklog: number;
  score: number;
  priorityLabel: 'high' | 'medium' | 'low';
}

interface TaskSuggestion {
  task: {
    id: string;
    title: string;
    estimatedMinutes: number;
    score: number;
    priority: string;
  };
  reasoning: string;
  fitScore: number; // How well this task fits this specific block
}

// Get time of day category
function getTimeOfDayCategory(time: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = time.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// Calculate how well a task fits a specific time block
function calculateFitScore(task: TaskWithScore, block: TimeBlock, timeOfDay: string): number {
  let score = task.score || 50; // Base score from priority/urgency
  
  // Time of day bonuses
  if (timeOfDay === 'morning') {
    // High-priority, complex tasks get morning bonus
    if (task.priority >= 70 && task.estimatedMinutes >= 60) {
      score += 15;
    }
    // Creative or strategic tasks
    if (task.title.toLowerCase().match(/plan|design|strategy|review|analyze/)) {
      score += 10;
    }
  } else if (timeOfDay === 'afternoon') {
    // Medium complexity tasks work well in afternoon
    if (task.estimatedMinutes >= 30 && task.estimatedMinutes <= 90) {
      score += 10;
    }
    // Collaborative tasks
    if (task.title.toLowerCase().match(/meeting|discuss|collaborate|team/)) {
      score += 10;
    }
  } else {
    // Evening: quick wins and wrap-up tasks
    if (task.estimatedMinutes <= 30) {
      score += 15;
    }
    // Administrative tasks
    if (task.title.toLowerCase().match(/email|update|document|report/)) {
      score += 10;
    }
  }
  
  // Block type bonuses
  if (block.type === 'email' && task.source === 'email') {
    score += 20;
  }
  if (block.type === 'work' && task.estimatedMinutes >= 45) {
    score += 10;
  }
  
  // Duration fit bonus (tasks that use 70-90% of block time)
  const startTime = typeof block.startTime === 'string' ? new Date(`2000-01-01 ${block.startTime}`) : block.startTime;
  const endTime = typeof block.endTime === 'string' ? new Date(`2000-01-01 ${block.endTime}`) : block.endTime;
  const blockMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  const utilizationRatio = task.estimatedMinutes / blockMinutes;
  if (utilizationRatio >= 0.7 && utilizationRatio <= 0.9) {
    score += 15;
  }
  
  return score;
}

// Generate reasoning for why a task is suggested
function generateReasoning(task: TaskWithScore, block: TimeBlock, timeOfDay: string, fitScore: number): string {
  const reasons = [];
  
  if (task.score > 70) {
    reasons.push('High priority task');
  }
  
  if (timeOfDay === 'morning' && task.priority >= 70) {
    reasons.push('Complex task best suited for morning focus');
  }
  
  if (task.estimatedMinutes <= 30 && fitScore > 60) {
    reasons.push('Quick win that fits well');
  }
  
  if (block.type === 'email' && task.source === 'email') {
    reasons.push('Email-based task for email block');
  }
  
  const startTime = typeof block.startTime === 'string' ? new Date(`2000-01-01 ${block.startTime}`) : block.startTime;
  const endTime = typeof block.endTime === 'string' ? new Date(`2000-01-01 ${block.endTime}`) : block.endTime;
  const blockMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  const utilizationRatio = task.estimatedMinutes / blockMinutes;
  if (utilizationRatio >= 0.7 && utilizationRatio <= 0.9) {
    reasons.push(`Uses ${Math.round(utilizationRatio * 100)}% of block time efficiently`);
  }
  
  return reasons.join('. ') || 'Good fit for this time block';
}

export const suggestTasksForBlock = tool({
  description: 'Suggest the best tasks to assign to a specific time block based on intelligent matching',
  parameters: z.object({
    blockId: z.string().describe('ID of the time block to get suggestions for'),
    maxSuggestions: z.number().default(5).describe('Maximum number of suggestions'),
    includeReasoning: z.boolean().default(true).describe('Include reasoning for each suggestion'),
  }),
  execute: async ({ blockId, maxSuggestions, includeReasoning }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'suggestTasksForBlock',
      operation: 'read' as const,
      resourceType: 'task' as const,
      startTime,
    };
    
    try {
      // Ensure services are configured before proceeding
      await ensureServicesConfigured();
      
      const scheduleService = ServiceFactory.getInstance().getScheduleService();
      
      // Get the block details
      const block = await scheduleService.getTimeBlock(blockId);
      if (!block) {
        return buildErrorResponse(
          toolOptions,
          { code: 'BLOCK_NOT_FOUND', message: 'Time block not found' },
          {
            title: 'Block Not Found',
            description: 'The specified time block was not found',
          }
        );
      }
      
      // Calculate block duration
      const blockMinutes = (block.endTime.getTime() - block.startTime.getTime()) / (1000 * 60);
      const timeOfDay = getTimeOfDayCategory(block.startTime);
      
      // Get unassigned tasks directly from service
      const taskService = ServiceFactory.getInstance().getTaskService();
      const unassignedTasks = await taskService.getUnassignedTasks();
      
      // Convert to TaskWithScore format
      const availableTasks: TaskWithScore[] = unassignedTasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: typeof task.priority === 'string' 
          ? (task.priority === 'high' ? 80 : task.priority === 'medium' ? 50 : 20)
          : 50,
        urgency: 50, // Default urgency
        estimatedMinutes: task.estimatedMinutes || 30,
        source: task.source || 'manual',
        createdAt: task.createdAt ? (typeof task.createdAt === 'string' ? task.createdAt : task.createdAt.toISOString()) : new Date().toISOString(),
        daysInBacklog: 0,
        score: 50,
        priorityLabel: task.priority === 'high' || task.priority === 'medium' || task.priority === 'low' 
          ? task.priority 
          : 'medium'
      }));
      
      // Calculate scores
      availableTasks.forEach(task => {
        const priorityWeight = 0.6;
        const urgencyWeight = 0.4;
        task.score = (task.priority * priorityWeight) + (task.urgency * urgencyWeight);
      });
      
      // Filter tasks that can fit in the block
      const fittingTasks = availableTasks.filter((task: TaskWithScore) => 
        task.estimatedMinutes <= blockMinutes
      );
      
      if (fittingTasks.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            suggestions: [],
            blockInfo: {
              type: block.type,
              duration: blockMinutes,
              timeOfDay
            },
            message: `No tasks found that fit in this ${blockMinutes}-minute ${block.type} block`
          },
          {
            type: 'card',
            title: 'No Tasks Available',
            description: `No tasks small enough for this ${blockMinutes}-minute block. Consider breaking down larger tasks.`,
            priority: 'low',
            components: []
          },
          {
            suggestions: ['Break down large tasks', 'Create smaller subtasks', 'Extend the block duration'],
            actions: []
          }
        );
      }
      
      // Calculate fit scores for each task
      const scoredTasks = fittingTasks.map((task: TaskWithScore) => ({
        task,
        fitScore: calculateFitScore(task, block, timeOfDay),
        reasoning: includeReasoning ? generateReasoning(task, block, timeOfDay, 0) : ''
      }));
      
      // Sort by fit score
      scoredTasks.sort((a, b) => b.fitScore - a.fitScore);
      
      // Get top suggestions
      const suggestions: TaskSuggestion[] = scoredTasks.slice(0, maxSuggestions).map(item => ({
        task: {
          id: item.task.id,
          title: item.task.title,
          estimatedMinutes: item.task.estimatedMinutes,
          score: Math.round(item.task.score),
          priority: item.task.priorityLabel
        },
        reasoning: item.reasoning || generateReasoning(item.task, block, timeOfDay, item.fitScore),
        fitScore: Math.round(item.fitScore)
      }));
      
      // Find combinations of tasks that could fill the block
      const combinations = findTaskCombinations(fittingTasks, blockMinutes);
      
      const result = {
        suggestions,
        blockInfo: {
          id: block.id,
          type: block.type,
          title: block.title,
          duration: blockMinutes,
          timeOfDay,
          startTime: format(block.startTime, 'h:mm a')
        },
        combinations: combinations.slice(0, 3).map(combo => ({
          tasks: combo.tasks.map((t: TaskWithScore) => ({
            title: t.title,
            minutes: t.estimatedMinutes
          })),
          totalMinutes: combo.totalMinutes,
          utilization: Math.round((combo.totalMinutes / blockMinutes) * 100)
        })),
        summary: `Found ${suggestions.length} tasks that fit this ${blockMinutes}-minute ${timeOfDay} ${block.type} block`
      };
      
      return buildToolResponse(
        toolOptions,
        result,
        {
          type: 'list',
          title: `Suggested Tasks for ${result.blockInfo.title}`,
          description: `${suggestions.length} tasks that fit this ${blockMinutes}-minute ${timeOfDay} block`,
          priority: 'medium',
          components: suggestions.map(s => ({
            type: 'taskCard' as const,
            data: {
              id: s.task.id,
              title: s.task.title,
              estimatedMinutes: s.task.estimatedMinutes,
              priority: s.task.priority as 'high' | 'medium' | 'low',
              status: 'backlog' as const,
              description: s.reasoning,
              score: s.fitScore, // Use fitScore as it's more relevant for this context
            }
          }))
        },
        {
          suggestions: suggestions.length > 0
            ? ['Assign the top suggestion', 'View more details', 'Try different criteria']
            : ['Break down large tasks', 'Create new tasks', 'Adjust block duration'],
          actions: suggestions.length > 0 ? [
            {
              id: 'assign-top-task',
              label: 'Assign Top Task',
              icon: 'plus',
              variant: 'primary',
              action: {
                type: 'tool',
                tool: 'assignTaskToBlock',
                params: {
                  taskId: suggestions[0]?.task.id,
                  blockId: blockId
                }
              }
            }
          ] : []
        }
      );
      
    } catch (error) {
      console.error('Error in suggestTasksForBlock:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Failed to suggest tasks',
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      );
    }
  },
});

// Find combinations of tasks that efficiently fill a block
interface TaskCombination {
  tasks: TaskWithScore[];
  totalMinutes: number;
}

function findTaskCombinations(tasks: TaskWithScore[], targetMinutes: number, maxCombos: number = 5): TaskCombination[] {
  const combinations: TaskCombination[] = [];
  
  // Simple greedy algorithm for now
  for (let i = 0; i < tasks.length && combinations.length < maxCombos; i++) {
    const firstTask = tasks[i];
    if (!firstTask) continue;
    
    const combo: TaskCombination = { tasks: [firstTask], totalMinutes: firstTask.estimatedMinutes };
    
    for (let j = 0; j < tasks.length; j++) {
      const nextTask = tasks[j];
      if (!nextTask) continue;
      
      if (i !== j && combo.totalMinutes + nextTask.estimatedMinutes <= targetMinutes) {
        combo.tasks.push(nextTask);
        combo.totalMinutes += nextTask.estimatedMinutes;
      }
    }
    
    // Only include combos that use at least 50% of the time
    if (combo.totalMinutes >= targetMinutes * 0.5) {
      combinations.push(combo);
    }
  }
  
  // Sort by utilization
  combinations.sort((a, b) => b.totalMinutes - a.totalMinutes);
  
  return combinations;
} 