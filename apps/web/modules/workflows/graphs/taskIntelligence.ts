/*
import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import { ServiceFactory } from '@/services/factory/service.factory';
import {
  findTasks,
  scoreTask,
  analyzeTaskPatterns,
  batchSimilarTasks,
  findTasksForTimeSlot,
  estimateTaskDuration,
  getTaskBacklogHealth
} from "@/modules/ai/tools";
import { getCurrentUserId } from '@/modules/ai/tools/utils/helpers';
import { format } from 'date-fns';
import {
  calculateEnergyMatch,
  calculatePatternMatch,
  generateTaskReasoning,
  findNextAvailableSlot
} from '../utils/scheduleHelpers';
import type {
  TaskState,
  TaskData,
  Change,
  Insight,
  ScoredTask,
  TaskRecommendation,
  TaskPattern
} from '../types/domain-workflow.types';

const WORKFLOW_NAME = 'taskIntelligence';

export function createTaskIntelligenceWorkflow() {
  const workflow = new StateGraph<TaskState>({
    channels: {
      userId: null,
      intent: null,
      ragContext: null,
      data: {
        tasks: [],
        taskBacklog: [],
        scoredTasks: [],
        recommendations: [],
        taskPatterns: [],
        currentEnergy: 'medium',
        availableMinutes: 0,
        focusArea: null,
      },
      proposedChanges: [],
      messages: [],
    },
  });

  // Add all nodes
  workflow.addNode("fetchTasks", fetchTasksNode);
  workflow.addNode("fetchRAGContext", fetchRAGContextNode);
  workflow.addNode("scoreTasks", scoreTasksNode);
  workflow.addNode("analyzeCapacity", analyzeCapacityNode);
  workflow.addNode("matchTasksToTime", matchTasksToTimeNode);
  workflow.addNode("suggestCombinations", suggestCombinationsNode);
  workflow.addNode("updateBacklog", updateBacklogNode);
  workflow.addNode("generateRecommendations", generateRecommendationsNode);

  // Define flow
  workflow.setEntryPoint("fetchTasks");
  workflow.addEdge("fetchTasks", "fetchRAGContext");
  workflow.addEdge("fetchRAGContext", "scoreTasks");
  workflow.addEdge("scoreTasks", "analyzeCapacity");
  workflow.addEdge("analyzeCapacity", "matchTasksToTime");
  workflow.addEdge("matchTasksToTime", "suggestCombinations");
  workflow.addEdge("suggestCombinations", "updateBacklog");
  workflow.addEdge("updateBacklog", "generateRecommendations");
  workflow.addEdge("generateRecommendations", END);

  return workflow.compile();
}

// Fetch all pending tasks and backlog
async function fetchTasksNode(state: TaskState): Promise<Partial<TaskState>> {
  try {
    const factory = ServiceFactory.getInstance();
    const taskService = factory.getTaskService();
    
    // Fetch pending tasks and backlog health in parallel
    const [pendingResult, backlogHealthResult] = await Promise.all([
      findTasks.execute({
        status: 'pending',
        limit: 50
      }),
      getTaskBacklogHealth.execute({})
    ]);
    
    const pendingTasks = pendingResult.data?.results || [];
    const backlogHealth = backlogHealthResult.data || { tasks: [] };
    
    return {
      data: {
        ...state.data,
        tasks: pendingTasks.filter(t => !t.days_in_backlog || t.days_in_backlog < 3),
        taskBacklog: pendingTasks.filter(t => t.days_in_backlog && t.days_in_backlog >= 3),
      },
      messages: [
        ...state.messages,
        new AIMessage(`Fetched ${pendingTasks.length} tasks (${backlogHealth.tasks?.length || 0} in backlog)`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in fetchTasks:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error fetching tasks: ${error instanceof Error ? error.message : 'Unknown error'}`)
      ]
    };
  }
}

// Fetch RAG context for task patterns
async function fetchRAGContextNode(state: TaskState): Promise<Partial<TaskState>> {
  try {
    // For now, return empty RAG context (Sprint 03.04)
    return {
      ragContext: {
        patterns: [],
        recentDecisions: [],
        similarDays: [],
      }
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in fetchRAGContext:`, error);
    return state;
  }
}

// Score tasks based on multiple factors
async function scoreTasksNode(state: TaskState): Promise<Partial<TaskState>> {
  try {
    const allTasks = [...state.data.tasks, ...state.data.taskBacklog];
    const scoredTasks: ScoredTask[] = [];
    
    // Score tasks in batches for performance
    const batchSize = 10;
    for (let i = 0; i < allTasks.length; i += batchSize) {
      const batch = allTasks.slice(i, i + batchSize);
      
      const scores = await Promise.all(
        batch.map(async (task) => {
          try {
            // Use the scoreTask tool
            const result = await scoreTask.execute({
              taskId: task.id,
              factors: {
                priority: task.priority === 'high' ? 100 : task.priority === 'medium' ? 50 : 25,
                daysInBacklog: task.days_in_backlog || 0,
                hasDeadline: !!task.due_date,
                energyLevel: state.data.currentEnergy,
                timeOfDay: new Date().getHours() < 12 ? 'morning' : 'afternoon',
              }
            });
            
            if (result.data) {
              const factors = {
                priority: task.priority === 'high' ? 100 : task.priority === 'medium' ? 50 : 25,
                urgency: result.data.score || 50,
                age: Math.min((task.days_in_backlog || 0) * 5, 20),
                energy: calculateEnergyMatch(task, state.data.currentEnergy),
                pattern: calculatePatternMatch(task, state.ragContext),
              };
              
              const totalScore = Object.values(factors).reduce((sum, val) => sum + val, 0);
              
              return {
                ...task,
                score: totalScore,
                factors,
                reasoning: result.data.reasoning || generateTaskReasoning(factors, task),
              } as ScoredTask;
            }
            
            // Fallback scoring
            const factors = {
              priority: task.priority === 'high' ? 100 : task.priority === 'medium' ? 50 : 25,
              urgency: 50,
              age: Math.min((task.days_in_backlog || 0) * 5, 20),
              energy: 50,
              pattern: 0,
            };
            
            return {
              ...task,
              score: Object.values(factors).reduce((sum, val) => sum + val, 0),
              factors,
              reasoning: generateTaskReasoning(factors, task),
            } as ScoredTask;
          } catch (error) {
            console.error(`Error scoring task ${task.id}:`, error);
            return null;
          }
        })
      );
      
      scoredTasks.push(...scores.filter((s): s is ScoredTask => s !== null));
    }
    
    // Sort by score descending
    scoredTasks.sort((a, b) => b.score - a.score);
    
    return {
      data: {
        ...state.data,
        scoredTasks,
      },
      messages: [
        ...state.messages,
        new AIMessage(`Scored ${scoredTasks.length} tasks based on multiple factors`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in scoreTasks:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error scoring tasks: ${error instanceof Error ? error.message : 'Unknown error'}`)
      ]
    };
  }
}

// Analyze available time and energy capacity
async function analyzeCapacityNode(state: TaskState): Promise<Partial<TaskState>> {
  try {
    const factory = ServiceFactory.getInstance();
    const scheduleService = factory.getScheduleService();
    
    // Get today's schedule to find available time
    const today = format(new Date(), 'yyyy-MM-dd');
    const schedule = await scheduleService.getScheduleForDate(today, state.userId);
    
    // Calculate available minutes from unassigned work blocks
    let availableMinutes = 0;
    const workBlocks = schedule.blocks.filter(b => b.type === 'work' && (!b.taskIds || b.taskIds.length === 0));
    
    workBlocks.forEach(block => {
      const start = new Date(`2000-01-01T${block.startTime}`);
      const end = new Date(`2000-01-01T${block.endTime}`);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);
      availableMinutes += duration;
    });
    
    // Adjust capacity based on energy level
    if (state.data.currentEnergy === 'low') {
      availableMinutes = Math.floor(availableMinutes * 0.7); // 70% capacity
    } else if (state.data.currentEnergy === 'high') {
      availableMinutes = Math.floor(availableMinutes * 1.2); // 120% capacity
    }
    
    return {
      data: {
        ...state.data,
        availableMinutes,
      },
      messages: [
        ...state.messages,
        new AIMessage(`${availableMinutes} minutes available for tasks (${state.data.currentEnergy} energy)`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in analyzeCapacity:`, error);
    return state;
  }
}

// Match tasks to available time slots
async function matchTasksToTimeNode(state: TaskState): Promise<Partial<TaskState>> {
  try {
    const proposedChanges: Change[] = [];
    let remainingMinutes = state.data.availableMinutes;
    
    // Get tasks that fit in available time
    for (const task of state.data.scoredTasks) {
      if (remainingMinutes <= 0) break;
      
      // Estimate task duration
      const durationResult = await estimateTaskDuration.execute({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        tags: task.tags || []
      });
      
      const estimatedDuration = durationResult.data?.estimatedMinutes || 30;
      
      if (estimatedDuration <= remainingMinutes) {
        // Find best time slot for this task
        const timeSlotResult = await findTasksForTimeSlot.execute({
          duration: estimatedDuration,
          energyLevel: state.data.currentEnergy,
          taskType: task.tags?.includes('creative') ? 'creative' : 'analytical'
        });
        
        if (timeSlotResult.data?.tasks?.length > 0) {
          proposedChanges.push({
            type: "assign",
            entity: "task",
            data: {
              taskId: task.id,
              duration: estimatedDuration,
              suggestedTime: timeSlotResult.data.suggestedTimeOfDay,
            },
            reason: `High-scoring task fits well in ${estimatedDuration}-minute slot`,
          });
          
          remainingMinutes -= estimatedDuration;
        }
      }
    }
    
    return {
      proposedChanges: [...state.proposedChanges, ...proposedChanges]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in matchTasksToTime:`, error);
    return state;
  }
}

// Suggest task combinations for efficiency
async function suggestCombinationsNode(state: TaskState): Promise<Partial<TaskState>> {
  try {
    // Use the suggestTaskCombinations tool
    const result = await batchSimilarTasks.execute({
      taskIds: state.data.scoredTasks.slice(0, 20).map(t => t.id), // Top 20 tasks
      maxGroupSize: 3,
      strategy: 'context'
    });
    
    if (result.data?.combinations) {
      const proposedChanges: Change[] = [];
      
      result.data.combinations.forEach((combo, index) => {
        if (combo.tasks.length > 1) {
          proposedChanges.push({
            type: "consolidate",
            entity: "task",
            data: {
              taskIds: combo.tasks.map(t => t.id),
              reason: combo.reason,
              estimatedTimeSaved: combo.estimatedTimeSaved,
            },
            reason: `Batch ${combo.tasks.length} similar tasks to save ${combo.estimatedTimeSaved} minutes`,
          });
        }
      });
      
      return {
        proposedChanges: [...state.proposedChanges, ...proposedChanges]
      };
    }
    
    return state;
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in suggestCombinations:`, error);
    return state;
  }
}

// Update task backlog health
async function updateBacklogNode(state: TaskState): Promise<Partial<TaskState>> {
  try {
    // Analyze task patterns
    const patternResult = await analyzeTaskPatterns.execute({
      timeframe: 'week'
    });
    
    if (patternResult.data) {
      const patterns: TaskPattern[] = [];
      
      // Extract patterns
      if (patternResult.data.completionPatterns) {
        patterns.push({
          type: 'completion',
          description: `Average ${patternResult.data.completionPatterns.averagePerDay} tasks completed per day`,
          data: patternResult.data.completionPatterns,
        });
      }
      
      if (patternResult.data.timeOfDayPatterns) {
        patterns.push({
          type: 'time_preference',
          description: `Most productive in the ${patternResult.data.timeOfDayPatterns.mostProductiveTime}`,
          data: patternResult.data.timeOfDayPatterns,
        });
      }
      
      return {
        data: {
          ...state.data,
          taskPatterns: patterns,
        }
      };
    }
    
    return state;
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in updateBacklog:`, error);
    return state;
  }
}

// Generate task recommendations
async function generateRecommendationsNode(state: TaskState): Promise<Partial<TaskState>> {
  try {
    const recommendations: TaskRecommendation[] = [];
    const insights: Insight[] = [];
    
    // Top priority recommendations
    const topTasks = state.data.scoredTasks.slice(0, 5);
    topTasks.forEach((task, index) => {
      recommendations.push({
        taskId: task.id,
        title: task.title,
        reason: task.reasoning,
        priority: index + 1,
        estimatedDuration: 30, // Default, would be calculated
      });
    });
    
    // Generate insights
    const highPriorityCount = state.data.scoredTasks.filter(t => t.factors.priority >= 100).length;
    const staleTaskCount = state.data.taskBacklog.filter(t => (t.days_in_backlog || 0) > 7).length;
    
    if (highPriorityCount > 5) {
      insights.push({
        type: "warning",
        message: `${highPriorityCount} high-priority tasks competing for attention`,
        severity: "high",
        data: { count: highPriorityCount }
      });
    }
    
    if (staleTaskCount > 0) {
      insights.push({
        type: "warning",
        message: `${staleTaskCount} tasks have been in backlog for over a week`,
        severity: "medium",
        data: { staleTaskIds: state.data.taskBacklog.filter(t => (t.days_in_backlog || 0) > 7).map(t => t.id) }
      });
    }
    
    // Capacity insights
    const totalTaskTime = state.proposedChanges
      .filter(c => c.type === 'assign')
      .reduce((sum, c) => sum + (c.data.duration || 0), 0);
    
    if (totalTaskTime > state.data.availableMinutes) {
      insights.push({
        type: "observation",
        message: `Task assignments exceed available time by ${totalTaskTime - state.data.availableMinutes} minutes`,
        severity: "medium"
      });
    }
    
    // Pattern insights
    state.data.taskPatterns.forEach(pattern => {
      if (pattern.type === 'completion' && pattern.data.trendsDown) {
        insights.push({
          type: "observation",
          message: "Task completion rate has been declining",
          severity: "low",
          data: pattern.data
        });
      }
    });
    
    // Next steps
    const nextSteps: string[] = [];
    if (recommendations.length > 0) {
      nextSteps.push(`Start with "${recommendations[0].title}" - ${recommendations[0].reason}`);
    }
    if (state.proposedChanges.some(c => c.type === 'consolidate')) {
      nextSteps.push("Batch similar tasks for efficiency");
    }
    if (staleTaskCount > 0) {
      nextSteps.push("Review and close or delegate stale tasks");
    }
    
    const summary = generateTaskSummary(state, recommendations);
    
    return {
      data: {
        ...state.data,
        recommendations,
        summary,
      },
      messages: [
        ...state.messages,
        new AIMessage(summary)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in generateRecommendations:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage("Task analysis complete")
      ]
    };
  }
}

// Helper function to generate summary
function generateTaskSummary(state: TaskState, recommendations: TaskRecommendation[]): string {
  const parts: string[] = [];
  
  parts.push(`Analyzed ${state.data.scoredTasks.length} tasks`);
  
  if (recommendations.length > 0) {
    parts.push(`top priority: "${recommendations[0].title}"`);
  }
  
  if (state.data.availableMinutes > 0) {
    parts.push(`${state.data.availableMinutes} minutes available`);
  }
  
  const assigned = state.proposedChanges.filter(c => c.type === 'assign').length;
  if (assigned > 0) {
    parts.push(`${assigned} tasks ready to assign`);
  }
  
  const batched = state.proposedChanges.filter(c => c.type === 'consolidate').length;
  if (batched > 0) {
    parts.push(`${batched} task batches suggested`);
  }
  
  return parts.join(', ') + '.';
}
*/ 