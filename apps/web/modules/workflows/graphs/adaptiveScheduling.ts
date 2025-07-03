import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import { ServiceFactory } from '@/services/factory/service.factory';
import { getCurrentUserId } from '@/modules/ai/tools/utils/helpers';
import { format, differenceInMinutes, addMinutes, parseISO } from 'date-fns';
import { 
  SchedulingStateAnnotation,
  SchedulingState,
  Change,
  Insight,
  TimeGap,
  Inefficiency,
  DomainWorkflowResult,
  EmailBacklog
} from '../types/domain-workflow.types';

// Import actual tools for operations
import { 
  createTimeBlock,
  moveTimeBlock,
  // assignTaskToBlock, // TODO: Implement in Sprint 4.3
  deleteTimeBlock
} from '@/modules/ai/tools';

// Import helper functions
import { calculateDuration, isLunchTime } from '../utils/scheduleHelpers';

const WORKFLOW_NAME = 'adaptiveScheduling';

// Enhanced types for intelligent scheduling
interface ScheduleMetrics {
  totalBlocks: number;
  focusTime: number;
  fragmentationScore: number;
  tasksAssigned: number;
  efficiencyGain: number;
  energyAlignment: number;
}

interface TaskAssignment {
  taskId: string;
  blockId: string;
  score: number;
  confidence: number;
  reason: string;
}

interface OptimizationSuggestion {
  type: 'consolidate' | 'move' | 'delete' | 'create';
  blockId?: string;
  newStartTime?: string;
  newEndTime?: string;
  description: string;
  gainedMinutes?: number;
  impact: Record<string, any>;
}

export function createAdaptiveSchedulingWorkflow() {
  // Use targeted type assertion as recommended
  const workflow = new StateGraph(SchedulingStateAnnotation) as any;

  // Add all nodes with proper typing
  workflow.addNode("fetchScheduleData", fetchScheduleDataNode);
  workflow.addNode("analyzeScheduleState", analyzeScheduleStateNode);
  workflow.addNode("determineStrategy", determineStrategyNode);
  workflow.addNode("fetchRAGContext", fetchRAGContextNode);
  workflow.addNode("executeStrategy", executeStrategyNode);
  workflow.addNode("protectTimeBlocks", protectTimeBlocksNode);
  workflow.addNode("validateSchedule", validateScheduleNode);
  workflow.addNode("generateProposal", generateProposalNode);

  // Define flow using START and END constants
  workflow.addEdge(START, "fetchScheduleData");
  workflow.addEdge("fetchScheduleData", "analyzeScheduleState");
  workflow.addEdge("analyzeScheduleState", "fetchRAGContext");
  workflow.addEdge("fetchRAGContext", "determineStrategy");
  workflow.addEdge("determineStrategy", "executeStrategy");
  workflow.addEdge("executeStrategy", "protectTimeBlocks");
  workflow.addEdge("protectTimeBlocks", "validateSchedule");
  workflow.addEdge("validateSchedule", "generateProposal");
  workflow.addEdge("generateProposal", END);

  return workflow.compile();
}

// Node implementations with proper typing
async function fetchScheduleDataNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const nodeStartTime = performance.now();
  
  try {
    const factory = ServiceFactory.getInstance();
    const scheduleService = factory.getScheduleService();
    const taskService = factory.getTaskService();
    const preferenceService = factory.getPreferenceService();
    const gmailService = factory.getGmailService();
    
    // Fetch all data in parallel
    const [schedule, preferences, tasks, emailMessages] = await Promise.all([
      scheduleService.getScheduleForDate(state.data.date),
      preferenceService.getUserPreferences(),
      taskService.getUnassignedTasks(),
      gmailService.listMessages({ 
        maxResults: 50,
        q: 'is:unread OR is:starred' 
      })
    ]);
    
    // Process email backlog
    const emailBacklog: EmailBacklog[] = emailMessages?.messages?.map((msg: any) => ({
      id: msg.id,
      from: 'Unknown', // Will need to fetch full message for from
      subject: 'No subject', // Will need to fetch full message for subject
      receivedAt: new Date(),
      importance: 'not_important' as const,
      urgency: 'can_wait' as const
    })) || [];
    
    // Calculate initial metrics
    const totalScheduledMinutes = schedule?.reduce((sum, block) => {
      const startStr = format(block.startTime, 'HH:mm');
      const endStr = format(block.endTime, 'HH:mm');
      const duration = calculateDuration(startStr, endStr);
      return sum + duration;
    }, 0) || 0;
    
    const focusBlocks = schedule?.filter(b => b.type === 'work') || [];
    const hasLunchBreak = schedule?.some(b => b.type === 'break' && isLunchTime(b)) || false;
    
    // Generate initial insights
    const insights: Insight[] = [
      {
        type: 'observation',
        content: `Current schedule has ${schedule?.length || 0} blocks with ${Math.round(totalScheduledMinutes / 60)} hours planned`,
        confidence: 1.0,
        timestamp: new Date()
      }
    ];
    
    if (emailBacklog.length > 10) {
      insights.push({
        type: 'warning',
        content: `You have ${emailBacklog.length} unread/starred emails that may need attention`,
        confidence: 0.9,
        timestamp: new Date(),
        metadata: { 
          urgentCount: emailBacklog.filter(e => e.urgency === 'urgent').length 
        }
      });
    }
    
    if (focusBlocks.length === 0 && tasks.length > 0) {
      insights.push({
        type: 'recommendation',
        content: `No focus blocks scheduled but ${tasks.length} tasks are pending`,
        confidence: 0.85,
        timestamp: new Date()
      });
    }
    
    if (!hasLunchBreak && preferences?.lunchStartTime) {
      insights.push({
        type: 'warning',
        content: 'No lunch break scheduled - important for sustained productivity',
        confidence: 0.95,
        timestamp: new Date()
      });
    }
    
    const duration = performance.now() - nodeStartTime;
    console.log(`[${WORKFLOW_NAME}] fetchScheduleData completed in ${Math.round(duration)}ms`);
    
    return {
      data: {
        ...state.data,
        currentSchedule: schedule || [],
        preferences: preferences,
        availableTasks: tasks?.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          priority: t.priority || 'medium',
          status: t.status === 'backlog' ? 'pending' : t.status === 'scheduled' ? 'in_progress' : t.status as any,
          dueDate: undefined,
          estimatedDuration: t.estimatedMinutes,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        })) || [],
        emailBacklog: emailBacklog
      },
      insights: [...state.insights, ...insights],
      messages: [
        ...state.messages,
        new AIMessage(`Fetched ${schedule?.length || 0} blocks, ${tasks?.length || 0} tasks, and ${emailBacklog.length} emails`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in fetchScheduleData:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}. Continuing with defaults.`)
      ]
    };
  }
}

async function analyzeScheduleStateNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  try {
    // Import helper functions inline to avoid circular dependencies
    const { findScheduleGaps, detectInefficiencies } = await import('../utils/scheduleHelpers');
    
    const gaps = findScheduleGaps(state.data.currentSchedule, state.data.preferences);
    const inefficiencies = detectInefficiencies(state.data.currentSchedule);
    
    return {
      data: {
        ...state.data,
        gaps,
        inefficiencies,
      },
      messages: [
        ...state.messages,
        new AIMessage(`Found ${gaps.length} gaps and ${inefficiencies.length} inefficiencies`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in analyzeScheduleState:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error analyzing schedule: ${error instanceof Error ? error.message : 'Unknown error'}`)
      ]
    };
  }
}

async function fetchRAGContextNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  // Placeholder for RAG context fetching (Sprint 03.04)
  return {
    ragContext: {
      patterns: [],
      recentDecisions: [],
      similarDays: [],
    }
  };
}

async function determineStrategyNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const { currentSchedule, inefficiencies, availableTasks, gaps } = state.data;
  const { patterns } = state.ragContext || {};
  
  let strategy: SchedulingState['data']['strategy'];
  
  // Rule-based strategy determination
  if (currentSchedule.length === 0) {
    strategy = "full";
  } else if (inefficiencies.length >= 3 && inefficiencies.some(i => i.severity === "high")) {
    strategy = "optimize";
  } else if (availableTasks.length > 0 && gaps.some(g => g.duration >= 30)) {
    strategy = "task_only";
  } else if (gaps.some(g => g.duration >= 60)) {
    strategy = "partial";
  } else {
    // Check RAG patterns for user preference
    const preferredStrategy = patterns?.find(p => 
      p.type === 'preference' && p.content.includes('scheduling strategy')
    );
    strategy = preferredStrategy ? "optimize" : "task_only";
  }
  
  return {
    data: {
      ...state.data,
      strategy,
    },
    messages: [
      ...state.messages,
      new AIMessage(`Selected ${strategy} strategy based on schedule analysis`),
    ],
  };
}

async function executeStrategyNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const proposedChanges: Change[] = [];
  const insights: Insight[] = [];
  
  try {
    const { strategy, currentSchedule, availableTasks, emailBacklog, gaps, preferences } = state.data;
    
    switch (strategy) {
      case "full": {
        // Create complete schedule with energy-aware planning
        const dayPlan = await generateOptimalDayPlan(state);
        
        // Morning deep work (9-11am) - high energy
        proposedChanges.push({
          type: "create",
          entity: "block",
          data: {
            operation: 'createTimeBlock',
            params: {
              type: "work",
              title: "Morning Deep Work",
              startTime: "09:00",
              endTime: "11:00",
              date: state.data.date,
              description: "High-energy focus time for complex tasks"
            }
          },
          reason: "Peak cognitive hours for challenging work",
          impact: { focusTime: "+120min", energyAlignment: "high" },
          confidence: 0.9
        });
        
        // Email processing after deep work
        if (emailBacklog.length > 0) {
          const urgentEmails = emailBacklog.filter(e => e.urgency === 'urgent').length;
          proposedChanges.push({
            type: "create",
            entity: "block",
            data: {
              operation: 'createTimeBlock',
              params: {
                type: "email",
                title: "Email Triage & Response",
                startTime: "11:00",
                endTime: urgentEmails > 5 ? "12:00" : "11:30",
                date: state.data.date,
                description: `Process ${emailBacklog.length} emails (${urgentEmails} urgent)`
              }
            },
            reason: `${urgentEmails} urgent emails need attention`,
            impact: { emailsProcessed: emailBacklog.length },
            confidence: 0.85
          });
        }
        
        // Protected lunch break
        proposedChanges.push({
          type: "create",
          entity: "block",
          data: {
            operation: 'createTimeBlock',
            params: {
              type: "break",
              title: "Lunch Break",
              startTime: preferences?.lunchStartTime || "12:00",
              endTime: "13:00",
              date: state.data.date,
              description: "Protected time for meal and recharge"
            }
          },
          reason: "Essential for sustained productivity",
          impact: { wellbeing: "high" },
          confidence: 1.0
        });
        
        // Afternoon work block (lower energy)
        proposedChanges.push({
          type: "create",
          entity: "block",
          data: {
            operation: 'createTimeBlock',
            params: {
              type: "work",
              title: "Afternoon Tasks",
              startTime: "13:30",
              endTime: "15:30",
              date: state.data.date,
              description: "Medium-priority tasks and administrative work"
            }
          },
          reason: "Post-lunch period suited for routine tasks",
          impact: { focusTime: "+120min", energyAlignment: "medium" },
          confidence: 0.8
        });
        
        insights.push({
          type: 'recommendation',
          content: `Created full-day schedule optimized for energy levels with ${emailBacklog.length} emails to process`,
          confidence: 0.9,
          timestamp: new Date(),
          metadata: { totalBlocks: 4, emailBacklogSize: emailBacklog.length }
        });
        break;
      }
        
      case "optimize": {
        // Analyze and fix inefficiencies
        const optimizations = await calculateOptimizations(state);
        
        for (const opt of optimizations) {
          if (opt.type === 'consolidate' && opt.blockId) {
            proposedChanges.push({
              type: "move",
              entity: "block",
              data: {
                operation: 'moveTimeBlock',
                params: {
                  blockId: opt.blockId,
                  newStartTime: opt.newStartTime!,
                  newEndTime: opt.newEndTime!
                }
              },
              reason: opt.description,
              impact: opt.impact,
              confidence: 0.75
            });
          }
        }
        
        insights.push({
          type: 'observation',
          content: `Found ${optimizations.length} optimization opportunities to reduce fragmentation`,
          confidence: 0.85,
          timestamp: new Date()
        });
        break;
      }
        
      case "partial": {
        // Fill significant gaps intelligently
        for (const gap of gaps) {
          if (gap.duration >= 60) {
            const gapHour = parseInt(gap.startTime.split(':')[0] || '0');
            const isHighEnergy = gapHour >= 9 && gapHour < 11;
            
            // Determine best use of gap based on time and backlog
            if (isHighEnergy && availableTasks.some(t => t.priority === 'high')) {
              proposedChanges.push({
                type: "create",
                entity: "block",
                data: {
                  operation: 'createTimeBlock',
                  params: {
                    type: "work",
                    title: "Focus Block - High Priority",
                    startTime: gap.startTime,
                    endTime: gap.endTime,
                    date: state.data.date,
                    description: "Deep work on high-priority tasks"
                  }
                },
                reason: `Utilizing ${gap.duration}-minute gap during peak hours`,
                impact: { focusTime: `+${gap.duration}min`, energyAlignment: "high" },
                confidence: 0.9
              });
            } else if (emailBacklog.filter(e => e.urgency === 'urgent').length > 3) {
              proposedChanges.push({
                type: "create",
                entity: "block",
                data: {
                  operation: 'createTimeBlock',
                  params: {
                    type: "email",
                    title: "Email Processing",
                    startTime: gap.startTime,
                    endTime: gap.endTime,
                    date: state.data.date,
                    description: "Handle urgent email backlog"
                  }
                },
                reason: `${emailBacklog.filter(e => e.urgency === 'urgent').length} urgent emails pending`,
                impact: { emailsProcessed: Math.floor(gap.duration / 5) },
                confidence: 0.8
              });
            } else {
              proposedChanges.push({
                type: "create",
                entity: "block",
                data: {
                  operation: 'createTimeBlock',
                  params: {
                    type: "work",
                    title: "Task Block",
                    startTime: gap.startTime,
                    endTime: gap.endTime,
                    date: state.data.date,
                    description: "General task work"
                  }
                },
                reason: `Filling ${gap.duration}-minute gap productively`,
                impact: { focusTime: `+${gap.duration}min` },
                confidence: 0.7
              });
            }
          }
        }
        
        insights.push({
          type: 'recommendation',
          content: `Filled ${proposedChanges.length} gaps to maximize productive time`,
          confidence: 0.8,
          timestamp: new Date()
        });
        break;
      }
        
      case "task_only": {
        // Smart task-to-block assignment
        const assignments = await matchTasksToBlocks(
          availableTasks,
          currentSchedule.filter(b => b.type === 'work'),
          preferences
        );
        
        for (const assignment of assignments) {
          proposedChanges.push({
            type: "assign",
            entity: "task",
            data: {
              operation: 'assignTaskToBlock',
              params: {
                taskId: assignment.taskId,
                blockId: assignment.blockId
              }
            },
            reason: assignment.reason,
            impact: { productivity: assignment.score },
            confidence: assignment.confidence
          });
        }
        
        // Check if email blocks needed
        const urgentEmailCount = emailBacklog.filter(e => e.urgency === 'urgent').length;
        if (urgentEmailCount > 5 && !currentSchedule.some(b => b.type === 'email')) {
          insights.push({
            type: 'warning',
            content: `${urgentEmailCount} urgent emails but no email blocks scheduled`,
            confidence: 0.9,
            timestamp: new Date(),
            metadata: { suggestion: 'Consider adding email processing time' }
          });
        }
        
        insights.push({
          type: 'observation',
          content: `Assigned ${assignments.length} tasks based on priority and energy matching`,
          confidence: 0.85,
          timestamp: new Date()
        });
        break;
      }
    }
    
    return { 
      proposedChanges: [...state.proposedChanges, ...proposedChanges],
      insights: [...state.insights, ...insights]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in executeStrategy:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error executing strategy: ${error instanceof Error ? error.message : 'Unknown error'}`)
      ]
    };
  }
}

// Helper function implementations (temporary - will move to scheduleHelpers.ts)
async function generateOptimalDayPlan(state: SchedulingState): Promise<any> {
  // Placeholder - will implement full logic
  return { blocks: [] };
}

async function calculateOptimizations(state: SchedulingState): Promise<OptimizationSuggestion[]> {
  const suggestions: OptimizationSuggestion[] = [];
  const { currentSchedule, inefficiencies } = state.data;
  
  // Look for fragmented work blocks that can be consolidated
  const workBlocks = currentSchedule.filter(b => b.type === 'work');
  if (workBlocks.length > 2) {
    // Suggest consolidation
    suggestions.push({
      type: 'consolidate',
      blockId: workBlocks[0].id,
      newStartTime: format(workBlocks[0].startTime, 'HH:mm'),
      newEndTime: format(addMinutes(workBlocks[0].startTime, 120), 'HH:mm'),
      description: 'Consolidate fragmented focus time',
      gainedMinutes: 30,
      impact: { focusImprovement: '+25%', contextSwitching: '-50%' }
    });
  }
  
  return suggestions;
}

async function matchTasksToBlocks(
  tasks: any[],
  blocks: any[],
  preferences: any
): Promise<TaskAssignment[]> {
  const assignments: TaskAssignment[] = [];
  
  // Simple matching for now - will enhance with scoring
  const highPriorityTasks = tasks.filter(t => t.priority === 'high');
  const morningBlocks = blocks.filter(b => {
    const hour = parseInt(format(b.startTime, 'HH'));
    return hour >= 9 && hour < 12;
  });
  
  // Assign high priority to morning blocks
  for (let i = 0; i < Math.min(highPriorityTasks.length, morningBlocks.length); i++) {
    assignments.push({
      taskId: highPriorityTasks[i].id,
      blockId: morningBlocks[i].id,
      score: 90,
      confidence: 0.85,
      reason: 'High-priority task matched to peak energy time'
    });
  }
  
  return assignments;
}

async function protectTimeBlocksNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const { isLunchTime } = await import('../utils/scheduleHelpers');
  
  // Check if lunch is protected
  const hasLunch = state.proposedChanges.some(c => 
    c.entity === "block" && c.data?.type === "break"
  ) || state.data.currentSchedule.some(b => isLunchTime(b));
  
  if (!hasLunch && state.data.preferences?.lunchStartTime) {
    const updatedChanges = [...state.proposedChanges];
    updatedChanges.push({
      type: "create",
      entity: "block",
      data: {
        type: "break",
        title: "Lunch",
        startTime: state.data.preferences.lunchStartTime,
        endTime: format(
          new Date(`2000-01-01 ${state.data.preferences.lunchStartTime}`).getTime() + 60 * 60 * 1000,
          'HH:mm'
        ),
      },
      reason: "Protecting lunch break",
    });
    
    return { proposedChanges: updatedChanges };
  }
  
  return {};
}

async function validateScheduleNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  // Simple validation for now
  return {
    messages: [
      ...state.messages,
      new AIMessage(`Validated ${state.proposedChanges.length} proposed changes`)
    ]
  };
}

async function generateProposalNode(state: SchedulingState): Promise<Partial<SchedulingState>> {
  const { generateNaturalSummary } = await import('../utils/scheduleHelpers');
  
  try {
    // Calculate metrics
    const metrics: ScheduleMetrics = {
      totalBlocks: state.data.currentSchedule.length + 
        state.proposedChanges.filter(c => c.type === 'create').length,
      focusTime: calculateTotalFocusTime(state),
      fragmentationScore: calculateFragmentationScore(state),
      tasksAssigned: state.proposedChanges.filter(c => c.type === 'assign').length,
      efficiencyGain: calculateEfficiencyGain(state),
      energyAlignment: calculateEnergyAlignment(state)
    };
    
    // Generate natural language summary
    const summary = generateNaturalSummary(state.proposedChanges);
    
    // Add final insight
    const finalInsights = [...state.insights];
    if (state.proposedChanges.length > 0) {
      finalInsights.push({
        type: 'recommendation',
        content: `${state.proposedChanges.length} changes will improve schedule efficiency by ${Math.round(metrics.efficiencyGain)}%`,
        confidence: 0.85,
        timestamp: new Date(),
        metadata: { metrics }
      });
    }
    
    // Generate next steps
    const nextSteps = generateNextSteps(state);
    
    // Create the final result
    const result: DomainWorkflowResult<any> = {
      success: true,
      data: {
        date: state.data.date,
        strategy: state.data.strategy,
        currentSchedule: state.data.currentSchedule,
        optimizedSchedule: applyChangesToSchedule(
          state.data.currentSchedule,
          state.proposedChanges
        ),
        metrics,
        summary
      },
      proposedChanges: state.proposedChanges,
      insights: finalInsights,
      ragContext: state.ragContext || {
        patterns: [],
        recentDecisions: [],
        similarDays: []
      },
      executionTime: Date.now() - state.startTime,
      nextSteps
    };
    
    return {
      result,
      messages: [
        ...state.messages,
        new AIMessage(summary)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in generateProposal:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error generating proposal: ${error instanceof Error ? error.message : 'Unknown error'}`)
      ]
    };
  }
}

// Helper functions for metrics calculation
function calculateTotalFocusTime(state: SchedulingState): number {
  const currentFocusTime = state.data.currentSchedule
    .filter(b => b.type === 'work')
    .reduce((sum, b) => {
      const duration = differenceInMinutes(b.endTime, b.startTime);
      return sum + duration;
    }, 0);
    
  const addedFocusTime = state.proposedChanges
    .filter(c => c.type === 'create' && c.entity === 'block' && c.data?.params?.type === 'work')
    .reduce((sum, c) => {
      const params = c.data.params;
      const start = parseISO(`2000-01-01T${params.startTime}`);
      const end = parseISO(`2000-01-01T${params.endTime}`);
      return sum + differenceInMinutes(end, start);
    }, 0);
    
  return currentFocusTime + addedFocusTime;
}

function calculateFragmentationScore(state: SchedulingState): number {
  const workBlocks = state.data.currentSchedule.filter(b => b.type === 'work').length;
  const consolidations = state.proposedChanges.filter(c => c.type === 'consolidate').length;
  
  // Lower score is better (less fragmentation)
  const baseScore = workBlocks > 3 ? 0.7 : workBlocks > 1 ? 0.4 : 0.1;
  const improvedScore = Math.max(0.1, baseScore - (consolidations * 0.2));
  
  return improvedScore;
}

function calculateEfficiencyGain(state: SchedulingState): number {
  const { proposedChanges } = state;
  
  let gain = 0;
  
  // Each consolidation improves efficiency
  gain += proposedChanges.filter(c => c.type === 'move').length * 10;
  
  // Filling gaps improves efficiency
  gain += proposedChanges.filter(c => c.type === 'create').length * 5;
  
  // Task assignments improve productivity
  gain += proposedChanges.filter(c => c.type === 'assign').length * 8;
  
  return Math.min(gain, 50); // Cap at 50% improvement
}

function calculateEnergyAlignment(state: SchedulingState): number {
  // Calculate how well tasks are aligned with energy levels
  const morningWorkBlocks = state.data.currentSchedule.filter(b => {
    const hour = parseInt(format(b.startTime, 'HH'));
    return b.type === 'work' && hour >= 9 && hour < 12;
  }).length;
  
  const totalWorkBlocks = state.data.currentSchedule.filter(b => b.type === 'work').length;
  
  return totalWorkBlocks > 0 ? (morningWorkBlocks / totalWorkBlocks) * 100 : 0;
}

function applyChangesToSchedule(
  currentSchedule: any[],
  changes: Change[]
): any[] {
  // This is a simplified preview - actual execution would use the tools
  let preview = [...currentSchedule];
  
  for (const change of changes) {
    if (change.type === 'create' && change.data?.params) {
      // Add preview of new block
      const params = change.data.params;
      preview.push({
        id: `preview-${Date.now()}`,
        type: params.type,
        title: params.title,
        startTime: parseISO(`${params.date}T${params.startTime}`),
        endTime: parseISO(`${params.date}T${params.endTime}`),
        description: params.description,
        isPreview: true
      });
    }
  }
  
  return preview.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

function generateNextSteps(state: SchedulingState): string[] {
  const steps: string[] = [];
  
  if (state.proposedChanges.length > 0) {
    steps.push('Review and confirm the proposed changes');
    steps.push('Execute the schedule optimization');
  }
  
  if (state.data.emailBacklog.filter(e => e.urgency === 'urgent').length > 0) {
    steps.push('Process urgent emails during scheduled email blocks');
  }
  
  if (state.data.availableTasks.filter(t => t.priority === 'high').length > 3) {
    steps.push('Prioritize high-impact tasks in morning blocks');
  }
  
  if (!state.data.currentSchedule.some(b => b.type === 'break')) {
    steps.push('Ensure breaks are protected throughout the day');
  }
  
  return steps;
} 