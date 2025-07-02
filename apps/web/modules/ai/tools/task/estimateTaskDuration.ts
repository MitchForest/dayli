import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';

interface DurationEstimate {
  baseEstimate: number;
  adjustedEstimate: number;
  confidence: 'high' | 'medium' | 'low';
  factors: {
    factor: string;
    impact: number; // minutes added/subtracted
    reason: string;
  }[];
  similarTasks: {
    title: string;
    estimatedMinutes: number;
    actualMinutes?: number;
  }[];
}

export const estimateTaskDuration = tool({
  description: 'Estimate task duration based on historical data, complexity, and context',
  parameters: z.object({
    taskId: z.string().optional().describe('ID of existing task to estimate'),
    taskDetails: z.object({
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
      tags: z.array(z.string()).optional(),
    }).optional().describe('Details for a new task to estimate'),
    includeBufferTime: z.boolean().optional().default(true).describe('Add buffer for interruptions'),
  }),
  execute: async ({ taskId, taskDetails, includeBufferTime }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'estimateTaskDuration',
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
      
      // Get historical data for similar tasks
      const allTasks = await taskService.searchTasks('');
      const similarTasks = findSimilarTasks(task, allTasks);
      
      // Base estimate from task complexity
      let baseEstimate = estimateFromComplexity(task);
      
      // Adjust based on historical data
      if (similarTasks.length > 0) {
        const avgHistorical = similarTasks.reduce((sum, t) => 
          sum + (t.estimatedMinutes || 30), 0
        ) / similarTasks.length;
        
        // Blend historical average with complexity estimate
        baseEstimate = Math.round((baseEstimate + avgHistorical) / 2);
      }
      
      // Apply adjustment factors
      const factors: DurationEstimate['factors'] = [];
      let adjustedEstimate = baseEstimate;
      
      // Priority factor
      if (task.priority === 'high') {
        const impact = Math.round(baseEstimate * 0.1);
        factors.push({
          factor: 'High Priority',
          impact: -impact,
          reason: 'High priority tasks often get more focus',
        });
        adjustedEstimate -= impact;
      } else if (task.priority === 'low') {
        const impact = Math.round(baseEstimate * 0.2);
        factors.push({
          factor: 'Low Priority',
          impact: impact,
          reason: 'Low priority tasks may have more interruptions',
        });
        adjustedEstimate += impact;
      }
      
      // Time of day factor (based on user preferences)
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('deep_work_preference')
        .eq('user_id', user.id)
        .single();
      
      if (preferences?.deep_work_preference && adjustedEstimate > 60) {
        factors.push({
          factor: 'Deep Work Task',
          impact: 0,
          reason: `Best scheduled during ${preferences.deep_work_preference} hours`,
        });
      }
      
      // Complexity factors
      const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
      
      if (taskText.match(/research|investigate|analyze/)) {
        const impact = 15;
        factors.push({
          factor: 'Research Required',
          impact,
          reason: 'Research tasks often take longer than expected',
        });
        adjustedEstimate += impact;
      }
      
      if (taskText.match(/meeting|discuss|collaborate/)) {
        const impact = 10;
        factors.push({
          factor: 'Collaboration',
          impact,
          reason: 'Coordination with others adds time',
        });
        adjustedEstimate += impact;
      }
      
      if (taskText.match(/first time|new|learn/)) {
        const impact = Math.round(baseEstimate * 0.3);
        factors.push({
          factor: 'Learning Curve',
          impact,
          reason: 'New tasks take longer initially',
        });
        adjustedEstimate += impact;
      }
      
      // Buffer time
      if (includeBufferTime) {
        const bufferAmount = Math.round(adjustedEstimate * 0.15);
        factors.push({
          factor: 'Buffer Time',
          impact: bufferAmount,
          reason: 'Buffer for interruptions and context switching',
        });
        adjustedEstimate += bufferAmount;
      }
      
      // Round to nearest 5 minutes
      adjustedEstimate = Math.round(adjustedEstimate / 5) * 5;
      
      // Determine confidence level
      let confidence: DurationEstimate['confidence'] = 'medium';
      if (similarTasks.length >= 3) {
        confidence = 'high';
      } else if (similarTasks.length === 0) {
        confidence = 'low';
      }
      
      const estimate: DurationEstimate = {
        baseEstimate,
        adjustedEstimate,
        confidence,
        factors,
        similarTasks: similarTasks.slice(0, 3).map(t => ({
          title: t.title,
          estimatedMinutes: t.estimatedMinutes || 30,
        })),
      };
      
      // Update task if it exists
      if (taskId && task.estimatedMinutes !== adjustedEstimate) {
        await taskService.updateTask(taskId, {
          estimatedMinutes: adjustedEstimate,
        });
      }
      
      return buildToolResponse(
        toolOptions,
        {
          task: {
            id: taskId,
            title: task.title,
            description: task.description,
          },
          estimate,
        },
        {
          type: 'card',
          title: 'Duration Estimate',
          description: `${task.title}: ${adjustedEstimate} minutes (${confidence} confidence)`,
          priority: 'medium',
          components: [
            {
              type: 'progressIndicator',
              data: {
                current: baseEstimate,
                total: adjustedEstimate,
                label: 'Base vs Adjusted',
                percentage: Math.round((baseEstimate / adjustedEstimate) * 100),
              },
            },
          ],
        },
        {
          suggestions: [
            adjustedEstimate > 90 ? 'Break this into smaller tasks' : null,
            confidence === 'low' ? 'Track actual time to improve estimates' : null,
            adjustedEstimate !== baseEstimate ? 'Review adjustment factors' : null,
            'Schedule this task',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: 'info',
            message: `Estimated duration: ${adjustedEstimate} minutes`,
            duration: 3000,
          },
        }
      );
      
    } catch (error) {
      console.error('[ESTIMATE TASK DURATION] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Estimation Failed',
          description: 'Could not estimate task duration.',
        }
      );
    }
  },
});

function estimateFromComplexity(task: any): number {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  let baseMinutes = 30; // Default
  
  // Task type indicators
  if (text.match(/quick|simple|minor|typo|small/)) {
    baseMinutes = 15;
  } else if (text.match(/complex|major|redesign|refactor|architecture/)) {
    baseMinutes = 120;
  } else if (text.match(/medium|moderate|standard/)) {
    baseMinutes = 60;
  }
  
  // Action indicators
  if (text.match(/review|check|verify/)) {
    baseMinutes = Math.min(baseMinutes, 30);
  } else if (text.match(/implement|build|create|develop/)) {
    baseMinutes = Math.max(baseMinutes, 60);
  } else if (text.match(/fix|debug|troubleshoot/)) {
    baseMinutes = Math.max(baseMinutes, 45);
  }
  
  return baseMinutes;
}

function findSimilarTasks(task: any, allTasks: any[]): any[] {
  const taskWords = new Set(
    `${task.title} ${task.description || ''}`
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
  );
  
  // Score each task by similarity
  const scoredTasks = allTasks
    .filter(t => t.id !== task.id && t.estimatedMinutes)
    .map(t => {
      const otherWords = new Set(
        `${t.title} ${t.description || ''}`
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3)
      );
      
      const intersection = new Set([...taskWords].filter(x => otherWords.has(x)));
      const union = new Set([...taskWords, ...otherWords]);
      
      const similarity = union.size > 0 ? intersection.size / union.size : 0;
      
      return { task: t, similarity };
    })
    .filter(item => item.similarity > 0.2)
    .sort((a, b) => b.similarity - a.similarity);
  
  return scoredTasks.map(item => item.task);
} 