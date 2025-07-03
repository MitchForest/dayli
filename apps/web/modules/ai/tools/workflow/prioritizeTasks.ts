import { z } from "zod";
import { createTool } from '../base/tool-factory';
import { registerTool } from '../base/tool-registry';
import { type PrioritizeTasksResponse } from '../types/responses';
import { generateText, generateObject, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '../utils/helpers';

const parameters = z.object({
  timeAvailable: z.number().optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  focusArea: z.string().optional(),
});

export const prioritizeTasks = registerTool(
  createTool<typeof parameters, PrioritizeTasksResponse>({
    name: 'workflow_prioritizeTasks',
    description: "Get intelligent task recommendations based on priority, energy, and focus",
    parameters,
    metadata: {
      category: 'workflow',
      displayName: 'Prioritize Tasks',
      requiresConfirmation: false,
      supportsStreaming: true,
    },
    execute: async ({ timeAvailable, energyLevel, focusArea }) => {
      try {
        // Step 1: Analyze task context
        const { object: analysis } = await generateObject({
          model: openai('gpt-4o'),
          schema: z.object({
            totalBacklogTasks: z.number(),
            hasHighPriorityTasks: z.boolean(),
            hasOverdueTasks: z.boolean(),
            averageTaskAge: z.number(),
            recommendedStrategy: z.enum(['urgent-first', 'quick-wins', 'deep-work', 'balanced'])
          }),
          prompt: `Analyze task backlog to determine prioritization strategy.
          Consider: energy level (${energyLevel || 'medium'}), time available (${timeAvailable || 'unlimited'}), focus area (${focusArea || 'general'}).`
        });
        
        // Step 2: Define sub-tools based on analysis
        const fetchAndScoreTasks = tool({
          description: 'Fetch tasks and calculate priority scores',
          parameters: z.object({
            focusArea: z.string().optional()
          }),
          execute: async ({ focusArea }) => {
            const factory = ServiceFactory.getInstance();
            const taskService = factory.getTaskService();
            
            // Get all active tasks
            const tasks = await taskService.getTaskBacklog();
            
            // Score each task
            const scoredTasks = tasks.map(task => {
              let score = 0;
              
              // Base priority score
              score += task.priority === 'high' ? 60 : task.priority === 'medium' ? 40 : 20;
              
              // Age bonus (older tasks get higher priority)
              const ageInDays = task.createdAt 
                ? Math.floor((Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              score += Math.min(ageInDays * 5, 20); // Max 20 points for age
              
              // Focus area alignment
              if (focusArea && task.title.toLowerCase().includes(focusArea.toLowerCase())) {
                score += 15;
              }
              
              // Estimated time bonus for quick wins
              if (task.estimatedMinutes && task.estimatedMinutes <= 15) {
                score += 10; // Quick win bonus
              }
              
              // Overdue penalty becomes a bonus (urgent!)
              // Tasks don't have dueDate, so we'll skip this for now
              
              return {
                ...task,
                score: Math.min(score, 100), // Cap at 100
                ageInDays,
                scoreFactors: {
                  priority: task.priority === 'high' ? 60 : task.priority === 'medium' ? 40 : 20,
                  age: Math.min(ageInDays * 5, 20),
                  focusAlignment: focusArea && task.title.toLowerCase().includes(focusArea.toLowerCase()) ? 15 : 0,
                  quickWin: task.estimatedMinutes && task.estimatedMinutes <= 15 ? 10 : 0,
                  overdue: 0 // Tasks don't have dueDate in our interface
                }
              };
            });
            
            // Sort by score descending
            scoredTasks.sort((a, b) => b.score - a.score);
            
            return {
              tasks: scoredTasks,
              stats: {
                total: tasks.length,
                highPriority: tasks.filter(t => t.priority === 'high').length,
                overdue: 0, // Tasks don't have dueDate
                quickWins: tasks.filter(t => t.estimatedMinutes && t.estimatedMinutes <= 15).length
              }
            };
          }
        });
        
        const matchTasksToEnergy = tool({
          description: 'Match tasks to current energy level',
          parameters: z.object({
            tasks: z.array(z.any()),
            energyLevel: z.string()
          }),
          execute: async ({ tasks, energyLevel }) => {
            const energyMatchedTasks = tasks.map((task: any) => {
              let energyBonus = 0;
              const estimatedMinutes = task.estimatedMinutes || 30;
              
              // Analyze task complexity based on title and description
              const complexityScore = analyzeTaskComplexity(task);
              
              if (energyLevel === 'high') {
                // Morning/high energy: prefer complex, creative, high-focus tasks
                if (complexityScore > 0.7) energyBonus = 15; // Complex/creative tasks
                else if (estimatedMinutes >= 60) energyBonus = 10; // Long tasks
                else if (task.priority === 'high') energyBonus = 8; // Important tasks
              } else if (energyLevel === 'low') {
                // Low energy: prefer quick, simple, routine tasks
                if (estimatedMinutes <= 15) energyBonus = 15; // Quick wins
                else if (complexityScore < 0.3) energyBonus = 12; // Routine tasks
                else if (task.source === 'email') energyBonus = 8; // Email-based tasks
              } else {
                // Medium energy: balanced approach
                if (estimatedMinutes >= 30 && estimatedMinutes <= 60) energyBonus = 10;
                else if (complexityScore >= 0.4 && complexityScore <= 0.6) energyBonus = 8;
              }
              
              // Time-of-day specific recommendations
              const timeOfDay = getTimeOfDay();
              const timeBonus = getTimeOfDayBonus(task, timeOfDay, energyLevel);
              
              return {
                ...task,
                score: Math.min(task.score + energyBonus + timeBonus, 100),
                energyMatch: energyBonus > 10 ? 'excellent' : energyBonus > 0 ? 'good' : 'neutral',
                complexityScore,
                recommendedTimeOfDay: getRecommendedTimeOfDay(task, complexityScore)
              };
            });
            
            // Re-sort after energy adjustment
            energyMatchedTasks.sort((a, b) => b.score - a.score);
            
            return {
              tasks: energyMatchedTasks
            };
          }
        });
        
        const generateRecommendations = tool({
          description: 'Generate final task recommendations',
          parameters: z.object({
            tasks: z.array(z.any()),
            timeAvailable: z.number().optional(),
            energyLevel: z.string()
          }),
          execute: async ({ tasks, timeAvailable, energyLevel }) => {
            let recommendations = [...tasks];
            
            // Filter by time available
            if (timeAvailable) {
              let totalTime = 0;
              recommendations = recommendations.filter(task => {
                const taskTime = task.estimatedMinutes || 30;
                if (totalTime + taskTime <= timeAvailable) {
                  totalTime += taskTime;
                  return true;
                }
                return false;
              });
            }
            
            // Add sophisticated recommendations
            recommendations = recommendations.slice(0, 5).map((task, index) => {
              const timeBlock = getSmartTimeBlock(task, energyLevel);
              const reason = getSmartReason(task, index, energyLevel);
              
              return {
                ...task,
                reason,
                suggestedTimeBlock: timeBlock
              };
            });
            
            return {
              recommendations,
              insights: {
                overdueCount: 0, // Tasks don't have dueDate
                highPriorityCount: tasks.filter((t: any) => t.priority === 'high').length,
                quickWinsCount: tasks.filter((t: any) => t.scoreFactors.quickWin > 0).length,
                averageAge: Math.round(tasks.reduce((sum: number, t: any) => sum + (t.ageInDays || 0), 0) / tasks.length),
                energyAlignment: energyLevel === 'high' ? 'Focus on complex tasks' :
                                energyLevel === 'low' ? 'Quick wins and simple tasks' :
                                'Balanced mix of tasks'
              },
              suggestedOrder: recommendations.map(r => r.id)
            };
          }
        });
        
        // Final answer tool
        const finalizePrioritization = tool({
          description: 'Finalize task prioritization',
          parameters: z.object({
            totalTasks: z.number(),
            recommendations: z.array(z.any()),
            insights: z.any(),
            suggestedOrder: z.array(z.string())
          }),
          execute: async ({ totalTasks, recommendations, insights, suggestedOrder }) => {
            return {
              totalTasks,
              recommendations,
              insights,
              suggestedOrder
            };
          }
        });
        
        // Execute workflow with dynamic tools
        const tools: any = {
          fetchAndScoreTasks,
          ...(energyLevel && { matchTasksToEnergy }),
          generateRecommendations,
          finalizePrioritization
        };
        
        const { toolCalls } = await generateText({
          model: openai('gpt-4o'),
          tools,
          maxSteps: 4,
          system: `You are an AI assistant helping prioritize tasks intelligently.
          
Context from analysis:
- Total backlog: ${analysis.totalBacklogTasks} tasks
- Has high priority: ${analysis.hasHighPriorityTasks}
- Has overdue: ${analysis.hasOverdueTasks}
- Strategy: ${analysis.recommendedStrategy}
- Energy level: ${energyLevel || 'medium'}
- Time available: ${timeAvailable || 'unlimited'} minutes
- Focus area: ${focusArea || 'general'}

Your task:
1. Fetch and score all tasks
2. ${energyLevel ? 'Match tasks to energy level' : 'Skip energy matching'}
3. Generate recommendations based on scores and constraints
4. Finalize the prioritization plan

Use multi-factor scoring: priority, age, focus alignment, quick wins, and overdue status.`,
          prompt: `Prioritize my tasks for ${energyLevel || 'medium'} energy level${focusArea ? ` focusing on ${focusArea}` : ''}.`,
          onStepFinish: ({ toolCalls }) => {
            if (toolCalls && toolCalls.length > 0) {
              console.log(`[prioritizeTasks] Step completed: ${toolCalls[0]?.toolName}`);
            }
          }
        });
        
        // Extract final plan using .args (not .result)
        const finalAnswer = toolCalls?.find(tc => tc && tc.toolName === 'finalizePrioritization');
        if (!finalAnswer) {
          throw new Error('Workflow did not produce a final prioritization');
        }
        
        const plan = finalAnswer.args as any;
        
        // Return pure data matching PrioritizeTasksResponse
        return {
          success: true,
          rankedTasks: plan.recommendations.map((rec: any) => ({
            id: rec.id,
            title: rec.title,
            score: rec.score,
            reason: rec.reason,
            suggestedTimeBlock: rec.suggestedTimeBlock
          })),
          insights: plan.insights
        };
      } catch (error) {
        console.error('[Workflow: prioritizeTasks] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to prioritize tasks',
          rankedTasks: [],
          insights: {
            overdueCount: 0,
            highPriorityCount: 0,
            quickWinsCount: 0
          }
        };
      }
    },
  })
);

// Helper functions for sophisticated behaviors
function analyzeTaskComplexity(task: any): number {
  let complexity = 0.5; // Base complexity
  
  const title = task.title.toLowerCase();
  const desc = (task.description || '').toLowerCase();
  
  // High complexity indicators
  const complexKeywords = ['design', 'architect', 'analyze', 'strategy', 'create', 'develop', 'research', 'plan'];
  const complexMatches = complexKeywords.filter(k => title.includes(k) || desc.includes(k)).length;
  complexity += complexMatches * 0.1;
  
  // Low complexity indicators
  const simpleKeywords = ['update', 'fix', 'change', 'move', 'copy', 'send', 'reply', 'schedule'];
  const simpleMatches = simpleKeywords.filter(k => title.includes(k) || desc.includes(k)).length;
  complexity -= simpleMatches * 0.1;
  
  // Task duration as complexity indicator
  if (task.estimatedMinutes) {
    if (task.estimatedMinutes >= 120) complexity += 0.2;
    else if (task.estimatedMinutes >= 60) complexity += 0.1;
    else if (task.estimatedMinutes <= 15) complexity -= 0.2;
  }
  
  // Priority as complexity indicator
  if (task.priority === 'high') complexity += 0.1;
  else if (task.priority === 'low') complexity -= 0.1;
  
  return Math.max(0, Math.min(1, complexity));
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getTimeOfDayBonus(task: any, timeOfDay: string, energyLevel: string): number {
  const complexity = task.complexityScore || 0.5;
  
  // Morning bonus for complex tasks
  if (timeOfDay === 'morning' && complexity > 0.6) {
    return energyLevel === 'high' ? 5 : 3;
  }
  
  // Afternoon bonus for meetings and collaborative work
  if (timeOfDay === 'afternoon' && (task.title.toLowerCase().includes('meeting') || 
      task.title.toLowerCase().includes('review') || 
      task.source === 'calendar')) {
    return 5;
  }
  
  // Late afternoon bonus for routine tasks
  if (timeOfDay === 'afternoon' && complexity < 0.4) {
    return energyLevel === 'low' ? 5 : 3;
  }
  
  return 0;
}

function getRecommendedTimeOfDay(task: any, complexity: number): string {
  // High complexity tasks -> morning
  if (complexity > 0.7) return 'morning (9-11am)';
  
  // Meetings and collaborative work -> early afternoon
  if (task.title.toLowerCase().includes('meeting') || 
      task.title.toLowerCase().includes('call') ||
      task.source === 'calendar') {
    return 'early afternoon (1-3pm)';
  }
  
  // Email and admin tasks -> late afternoon
  if (task.source === 'email' || complexity < 0.3) {
    return 'late afternoon (3-5pm)';
  }
  
  // Medium complexity -> flexible
  return 'anytime';
}

function getSmartTimeBlock(task: any, energyLevel: string): string {
  const complexity = task.complexityScore || 0.5;
  const timeOfDay = getTimeOfDay();
  
  // High energy + complex task = morning deep work
  if (energyLevel === 'high' && complexity > 0.6) {
    return 'morning (deep work block)';
  }
  
  // Low energy + simple task = afternoon admin
  if (energyLevel === 'low' && complexity < 0.4) {
    return 'afternoon (admin block)';
  }
  
  // Meeting-based tasks
  if (task.title.toLowerCase().includes('meeting') || task.source === 'calendar') {
    return 'early afternoon (meeting block)';
  }
  
  // Email-based tasks
  if (task.source === 'email') {
    return 'late afternoon (email block)';
  }
  
  // Default based on energy
  return energyLevel === 'high' ? 'morning' :
         energyLevel === 'low' ? 'afternoon' :
         'flexible';
}

function getSmartReason(task: any, index: number, energyLevel: string): string {
  const complexity = task.complexityScore || 0.5;
  
  if (index === 0) {
    if (energyLevel === 'high' && complexity > 0.7) {
      return `Perfect for high energy - complex task requiring deep focus (score: ${task.score})`;
    } else if (energyLevel === 'low' && task.estimatedMinutes <= 15) {
      return `Quick win to build momentum - can complete in ${task.estimatedMinutes} minutes`;
    }
    return `Highest priority score (${task.score}/100) - ${task.energyMatch} energy match`;
  }
  
  if (index === 1) {
    if (task.source === task.rankedTasks?.[0]?.source) {
      return `Context match - continues work from same source (${task.source})`;
    }
    return `Strong follow-up task (score: ${task.score}) - maintains momentum`;
  }
  
  if (index < 3) {
    return `Good task for ${energyLevel} energy - complexity score: ${complexity.toFixed(1)}`;
  }
  
  return 'Complete if time permits - quick win opportunity';
} 