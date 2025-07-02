import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { parseFlexibleTime } from '../../utils/time-parser';

interface TaskMatch {
  task: any;
  fitScore: number;
  reasoning: string;
}

export const findTasksForTimeSlot = tool({
  description: 'Find tasks that would fit well in a specific time slot based on duration, energy, and context',
  parameters: z.object({
    startTime: z.string().describe('Start time of the slot (e.g., "2:00 PM")'),
    endTime: z.string().describe('End time of the slot (e.g., "3:30 PM")'),
    energyLevel: z.enum(['high', 'medium', 'low']).optional().describe('Energy level during this time'),
    context: z.string().optional().describe('Context or type of work preferred for this slot'),
    excludeTaskIds: z.array(z.string()).optional().describe('Task IDs to exclude from results'),
  }),
  execute: async ({ startTime, endTime, energyLevel, context, excludeTaskIds = [] }): Promise<UniversalToolResponse> => {
    const startTimeMs = Date.now();
    const toolOptions = {
      toolName: 'findTasksForTimeSlot',
      operation: 'read' as const,
      resourceType: 'task' as const,
      startTime: startTimeMs,
    };
    
    try {
      await ensureServicesConfigured();
      const taskService = ServiceFactory.getInstance().getTaskService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Parse times
      const start = parseFlexibleTime(startTime);
      const end = parseFlexibleTime(endTime);
      
      if (!start || !end) {
        throw new Error('Invalid time format');
      }
      
      // Calculate slot duration in minutes
      const slotMinutes = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute);
      
      if (slotMinutes <= 0) {
        throw new Error('End time must be after start time');
      }
      
      // Get unassigned tasks
      const unassignedTasks = await taskService.getUnassignedTasks();
      
      // Filter out excluded tasks
      const availableTasks = unassignedTasks.filter(
        task => !excludeTaskIds.includes(task.id)
      );
      
      // Score and filter tasks
      const taskMatches: TaskMatch[] = [];
      
      for (const task of availableTasks) {
        const estimatedMinutes = task.estimatedMinutes || 30;
        
        // Skip tasks that are too long for the slot
        if (estimatedMinutes > slotMinutes) continue;
        
        // Calculate fit score
        let fitScore = 0;
        let reasoning = [];
        
        // Duration fit (prefer tasks that use most of the slot)
        const utilizationRatio = estimatedMinutes / slotMinutes;
        if (utilizationRatio >= 0.8 && utilizationRatio <= 1.0) {
          fitScore += 40;
          reasoning.push('Perfect duration fit');
        } else if (utilizationRatio >= 0.5) {
          fitScore += 25;
          reasoning.push('Good duration fit');
        } else {
          fitScore += 10;
          reasoning.push('Short task for slot');
        }
        
        // Energy level matching
        if (energyLevel) {
          const taskComplexity = estimateTaskComplexity(task);
          
          if (energyLevel === 'high' && taskComplexity === 'high') {
            fitScore += 30;
            reasoning.push('Complex task matches high energy');
          } else if (energyLevel === 'low' && taskComplexity === 'low') {
            fitScore += 30;
            reasoning.push('Simple task matches low energy');
          } else if (energyLevel === 'medium' && taskComplexity === 'medium') {
            fitScore += 30;
            reasoning.push('Moderate task matches medium energy');
          } else if (
            (energyLevel === 'high' && taskComplexity === 'low') ||
            (energyLevel === 'low' && taskComplexity === 'high')
          ) {
            fitScore -= 10;
            reasoning.push('Energy mismatch');
          }
        }
        
        // Context matching
        if (context && task.description) {
          const contextWords = context.toLowerCase().split(/\s+/);
          const taskText = `${task.title} ${task.description}`.toLowerCase();
          const matches = contextWords.filter(word => taskText.includes(word));
          
          if (matches.length > 0) {
            fitScore += matches.length * 10;
            reasoning.push(`Matches context: ${matches.join(', ')}`);
          }
        }
        
        // Priority boost
        if (task.priority === 'high') {
          fitScore += 15;
          reasoning.push('High priority');
        } else if (task.priority === 'medium') {
          fitScore += 5;
          reasoning.push('Medium priority');
        }
        
        taskMatches.push({
          task,
          fitScore,
          reasoning: reasoning.join('; '),
        });
      }
      
      // Sort by fit score
      taskMatches.sort((a, b) => b.fitScore - a.fitScore);
      
      // Take top matches
      const topMatches = taskMatches.slice(0, 5);
      
      return buildToolResponse(
        toolOptions,
        {
          timeSlot: {
            startTime: start.formatted,
            endTime: end.formatted,
            durationMinutes: slotMinutes,
            energyLevel,
            context,
          },
          matches: topMatches,
          totalCandidates: taskMatches.length,
        },
        {
          type: 'list',
          title: 'Tasks for Time Slot',
          description: `Found ${topMatches.length} tasks that fit the ${slotMinutes}-minute slot`,
          priority: 'medium',
          components: topMatches.map(match => ({
            type: 'taskCard',
            data: {
              id: match.task.id,
              title: match.task.title,
              priority: match.task.priority || 'medium',
              estimatedMinutes: match.task.estimatedMinutes || 30,
              status: match.task.status || 'backlog',
              description: match.reasoning,
              score: match.fitScore,
            },
          })),
        },
        {
          suggestions: topMatches.length > 0 ? [
            `Assign "${topMatches[0]?.task.title}" to this slot`,
            'View all unassigned tasks',
            'Adjust time slot duration',
          ] : [
            'No tasks fit this slot perfectly',
            'Break longer tasks into subtasks',
            'Extend the time slot',
          ],
          actions: topMatches.length > 0 && topMatches[0] ? [{
            id: 'assign-best',
            label: `Assign ${topMatches[0].task.title}`,
            variant: 'primary',
            action: {
              type: 'message',
              message: `Assign task "${topMatches[0].task.title}" to the ${startTime} - ${endTime} slot`,
            },
          }] : [],
        }
      );
      
    } catch (error) {
      console.error('[FIND TASKS FOR TIME SLOT] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Search Failed',
          description: 'Could not find tasks for the time slot.',
        }
      );
    }
  },
});

function estimateTaskComplexity(task: any): 'high' | 'medium' | 'low' {
  const title = task.title.toLowerCase();
  const description = (task.description || '').toLowerCase();
  const text = `${title} ${description}`;
  
  // High complexity indicators
  const highComplexityWords = ['design', 'architect', 'analyze', 'research', 'strategy', 'plan', 'review', 'debug'];
  if (highComplexityWords.some(word => text.includes(word))) {
    return 'high';
  }
  
  // Low complexity indicators
  const lowComplexityWords = ['update', 'fix', 'typo', 'rename', 'move', 'delete', 'simple', 'quick'];
  if (lowComplexityWords.some(word => text.includes(word))) {
    return 'low';
  }
  
  // Duration-based estimation
  if (task.estimatedMinutes) {
    if (task.estimatedMinutes >= 90) return 'high';
    if (task.estimatedMinutes <= 20) return 'low';
  }
  
  return 'medium';
} 