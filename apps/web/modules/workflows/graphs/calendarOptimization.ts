/*
import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import { ServiceFactory } from '@/services/factory/service.factory';
import {
  detectConflicts,
  suggestConflictResolution,
  analyzeMeetingPatterns,
  suggestMeetingConsolidation,
  protectTimeOnCalendar,
  findOptimalMeetingTime,
  rescheduleMeeting
} from "@/modules/ai/tools";
import { getCurrentUserId } from '@/modules/ai/tools/utils/helpers';
import { format, addDays } from 'date-fns';
import {
  findNextAvailableSlot,
  generateNaturalSummary
} from '../utils/scheduleHelpers';
import type {
  CalendarState,
  CalendarData,
  Change,
  Insight,
  Conflict,
  MeetingOptimization,
  CalendarPattern
} from '../types/domain-workflow.types';

const WORKFLOW_NAME = 'calendarOptimization';

export function createCalendarOptimizationWorkflow() {
  const workflow = new StateGraph<CalendarState>({
    channels: {
      userId: null,
      intent: null,
      ragContext: null,
      data: {
        meetings: [],
        conflicts: [],
        inefficiencies: [],
        optimizations: [],
        patterns: [],
        startDate: '',
        days: 1,
      },
      proposedChanges: [],
      messages: [],
    },
  });

  // Add all nodes
  workflow.addNode("fetchCalendarData", fetchCalendarDataNode);
  workflow.addNode("detectConflicts", detectConflictsNode);
  workflow.addNode("analyzeEfficiency", analyzeEfficiencyNode);
  workflow.addNode("fetchRAGContext", fetchRAGContextNode);
  workflow.addNode("generateResolutions", generateResolutionsNode);
  workflow.addNode("optimizeMeetings", optimizeMeetingsNode);
  workflow.addNode("protectFocusTime", protectFocusTimeNode);
  workflow.addNode("generateProposal", generateProposalNode);

  // Define flow
  workflow.setEntryPoint("fetchCalendarData");
  workflow.addEdge("fetchCalendarData", "detectConflicts");
  workflow.addEdge("detectConflicts", "analyzeEfficiency");
  workflow.addEdge("analyzeEfficiency", "fetchRAGContext");
  workflow.addEdge("fetchRAGContext", "generateResolutions");
  workflow.addEdge("generateResolutions", "optimizeMeetings");
  workflow.addEdge("optimizeMeetings", "protectFocusTime");
  workflow.addEdge("protectFocusTime", "generateProposal");
  workflow.addEdge("generateProposal", END);

  return workflow.compile();
}

// Fetch calendar data for specified date range
async function fetchCalendarDataNode(state: CalendarState): Promise<Partial<CalendarState>> {
  try {
    const factory = ServiceFactory.getInstance();
    const calendarService = factory.getCalendarService();
    
    // Fetch meetings for each day in range
    const meetings = [];
    for (let i = 0; i < state.data.days; i++) {
      const date = format(addDays(new Date(state.data.startDate), i), 'yyyy-MM-dd');
      const dayMeetings = await calendarService.getMeetingsForDate(date, state.userId);
      meetings.push(...dayMeetings);
    }
    
    return {
      data: {
        ...state.data,
        meetings,
      },
      messages: [
        ...state.messages,
        new AIMessage(`Fetched ${meetings.length} meetings for ${state.data.days} day(s)`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in fetchCalendarData:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage(`Error fetching calendar data: ${error instanceof Error ? error.message : 'Unknown error'}`)
      ]
    };
  }
}

// Detect conflicts in meetings
async function detectConflictsNode(state: CalendarState): Promise<Partial<CalendarState>> {
  try {
    // Use the detectConflicts tool
    const result = await detectConflicts.execute({
      date: state.data.startDate,
      includeAdjacentDays: state.data.days > 1
    });
    
    const conflicts: Conflict[] = [];
    
    if (result.data?.conflicts) {
      result.data.conflicts.forEach(conflict => {
        conflicts.push({
          id: `conflict-${Date.now()}-${Math.random()}`,
          type: conflict.type as 'overlap' | 'back_to_back' | 'insufficient_break',
          meetings: conflict.meetingIds,
          severity: conflict.severity as 'low' | 'medium' | 'high',
          description: conflict.description,
          suggestedResolution: conflict.suggestedResolution,
        });
      });
    }
    
    return {
      data: {
        ...state.data,
        conflicts,
      },
      messages: [
        ...state.messages,
        new AIMessage(`Detected ${conflicts.length} calendar conflicts`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in detectConflicts:`, error);
    return state;
  }
}

// Analyze meeting efficiency and patterns
async function analyzeEfficiencyNode(state: CalendarState): Promise<Partial<CalendarState>> {
  try {
    // Analyze meeting patterns
    const patternResult = await analyzeMeetingPatterns.execute({
      timeframe: 'month'
    });
    
    const inefficiencies: MeetingOptimization[] = [];
    const patterns: CalendarPattern[] = [];
    
    if (patternResult.data) {
      // Extract patterns
      if (patternResult.data.meetingFrequency) {
        patterns.push({
          type: 'frequency',
          description: `Average ${patternResult.data.meetingFrequency.averagePerDay} meetings per day`,
          data: patternResult.data.meetingFrequency,
        });
      }
      
      if (patternResult.data.timeDistribution) {
        patterns.push({
          type: 'time_distribution',
          description: 'Meeting time distribution throughout the day',
          data: patternResult.data.timeDistribution,
        });
      }
      
      // Identify inefficiencies
      const meetingsByDay = new Map<string, typeof state.data.meetings>();
      state.data.meetings.forEach(meeting => {
        const date = meeting.date;
        if (!meetingsByDay.has(date)) {
          meetingsByDay.set(date, []);
        }
        meetingsByDay.get(date)!.push(meeting);
      });
      
      // Check for meeting-heavy days
      meetingsByDay.forEach((meetings, date) => {
        if (meetings.length > 5) {
          inefficiencies.push({
            type: 'meeting_overload',
            description: `${meetings.length} meetings on ${date} - consider spreading them out`,
            meetingIds: meetings.map(m => m.id),
            potentialTimeSaved: 30, // Could consolidate or move some
          });
        }
        
        // Check for fragmented schedule
        const totalMeetingTime = meetings.reduce((sum, m) => {
          const start = new Date(`2000-01-01T${m.startTime}`);
          const end = new Date(`2000-01-01T${m.endTime}`);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60);
        }, 0);
        
        if (totalMeetingTime > 240 && meetings.length > 3) { // More than 4 hours in 3+ meetings
          inefficiencies.push({
            type: 'fragmented_schedule',
            description: 'Too many context switches between meetings',
            meetingIds: meetings.map(m => m.id),
            potentialTimeSaved: 20,
          });
        }
      });
    }
    
    return {
      data: {
        ...state.data,
        inefficiencies,
        patterns,
      },
      messages: [
        ...state.messages,
        new AIMessage(`Found ${inefficiencies.length} optimization opportunities`)
      ]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in analyzeEfficiency:`, error);
    return state;
  }
}

// Fetch RAG context for meeting patterns
async function fetchRAGContextNode(state: CalendarState): Promise<Partial<CalendarState>> {
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

// Generate conflict resolutions
async function generateResolutionsNode(state: CalendarState): Promise<Partial<CalendarState>> {
  try {
    const proposedChanges: Change[] = [];
    
    // Handle each conflict
    for (const conflict of state.data.conflicts) {
      if (conflict.severity === 'high') {
        // Use the suggestConflictResolution tool
        const result = await suggestConflictResolution.execute({
          conflictType: conflict.type,
          meetingIds: conflict.meetings,
          preferredStrategy: 'reschedule' // Could come from RAG context
        });
        
        if (result.data?.resolution) {
          const resolution = result.data.resolution;
          
          if (resolution.action === 'reschedule') {
            proposedChanges.push({
              type: 'move',
              entity: 'meeting',
              data: {
                meetingId: resolution.meetingToMove,
                newTime: resolution.suggestedTime,
                reason: resolution.reason,
              },
              reason: `Resolving ${conflict.type} conflict`,
            });
          } else if (resolution.action === 'merge') {
            proposedChanges.push({
              type: 'consolidate',
              entity: 'meeting',
              data: {
                meetingIds: conflict.meetings,
                reason: resolution.reason,
              },
              reason: 'Consolidating overlapping meetings',
            });
          }
        }
      } else if (conflict.type === 'back_to_back') {
        // Add buffer time
        proposedChanges.push({
          type: 'update',
          entity: 'meeting',
          data: {
            meetingId: conflict.meetings[1], // Second meeting
            adjustStartTime: 5, // 5 minutes later
          },
          reason: 'Adding buffer time between meetings',
        });
      }
    }
    
    return {
      proposedChanges: [...state.proposedChanges, ...proposedChanges]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in generateResolutions:`, error);
    return state;
  }
}

// Optimize meeting schedule
async function optimizeMeetingsNode(state: CalendarState): Promise<Partial<CalendarState>> {
  try {
    const proposedChanges: Change[] = [];
    
    // Check for consolidation opportunities
    const consolidationResult = await suggestMeetingConsolidation.execute({
      timeframe: 'week',
      minSimilarity: 0.7
    });
    
    if (consolidationResult.data?.suggestions) {
      consolidationResult.data.suggestions.forEach(suggestion => {
        if (suggestion.confidence > 0.8) {
          proposedChanges.push({
            type: 'consolidate',
            entity: 'meeting',
            data: {
              meetingIds: suggestion.meetingIds,
              newTitle: suggestion.suggestedTitle,
              estimatedTimeSaved: suggestion.estimatedMinutesSaved,
            },
            reason: suggestion.reason,
          });
        }
      });
    }
    
    // Handle inefficiencies
    state.data.inefficiencies.forEach(inefficiency => {
      if (inefficiency.type === 'meeting_overload') {
        // Find meetings that could be moved
        const meetingsToMove = inefficiency.meetingIds.slice(0, 2); // Move up to 2 meetings
        
        meetingsToMove.forEach(meetingId => {
          proposedChanges.push({
            type: 'move',
            entity: 'meeting',
            data: {
              meetingId,
              suggestAlternativeDay: true,
            },
            reason: 'Spreading meetings across multiple days',
          });
        });
      }
    });
    
    return {
      proposedChanges: [...state.proposedChanges, ...proposedChanges]
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in optimizeMeetings:`, error);
    return state;
  }
}

// Protect focus time
async function protectFocusTimeNode(state: CalendarState): Promise<Partial<CalendarState>> {
  try {
    // Use the protectTimeOnCalendar tool
    const result = await protectTimeOnCalendar.execute({
      date: state.data.startDate,
      blocks: [
        {
          type: 'focus',
          startTime: '09:00',
          endTime: '11:00',
          title: 'Deep Work',
          priority: 'high'
        },
        {
          type: 'focus',
          startTime: '14:00',
          endTime: '16:00',
          title: 'Afternoon Focus',
          priority: 'medium'
        }
      ]
    });
    
    if (result.data?.conflictingMeetings && result.data.conflictingMeetings.length > 0) {
      const proposedChanges: Change[] = [];
      
      result.data.conflictingMeetings.forEach(conflict => {
        proposedChanges.push({
          type: 'move',
          entity: 'meeting',
          data: {
            meetingId: conflict.meetingId,
            reason: `Conflicts with ${conflict.blockType} time`,
            suggestedTime: conflict.suggestedAlternativeTime,
          },
          reason: 'Protecting focus time',
        });
      });
      
      return {
        proposedChanges: [...state.proposedChanges, ...proposedChanges]
      };
    }
    
    return state;
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in protectFocusTime:`, error);
    return state;
  }
}

// Generate optimization proposal
async function generateProposalNode(state: CalendarState): Promise<Partial<CalendarState>> {
  try {
    const summary = generateCalendarSummary(state);
    
    // Generate insights
    const insights: Insight[] = [];
    
    // Conflict insights
    const highSeverityConflicts = state.data.conflicts.filter(c => c.severity === 'high').length;
    if (highSeverityConflicts > 0) {
      insights.push({
        type: "warning",
        message: `${highSeverityConflicts} high-severity conflicts need immediate attention`,
        severity: "high"
      });
    }
    
    // Efficiency insights
    const totalTimeSaved = state.proposedChanges
      .filter(c => c.type === 'consolidate')
      .reduce((sum, c) => sum + (c.data.estimatedTimeSaved || 0), 0);
    
    if (totalTimeSaved > 60) {
      insights.push({
        type: "recommendation",
        message: `Can save ${Math.round(totalTimeSaved / 60)} hours by consolidating meetings`,
        severity: "medium"
      });
    }
    
    // Pattern insights
    state.data.patterns.forEach(pattern => {
      if (pattern.type === 'frequency' && pattern.data.averagePerDay > 6) {
        insights.push({
          type: "observation",
          message: "High meeting load detected - consider no-meeting blocks",
          severity: "medium",
          data: pattern.data
        });
      }
    });
    
    // Next steps
    const nextSteps: string[] = [];
    if (state.data.conflicts.length > 0) {
      nextSteps.push("Review and approve conflict resolutions");
    }
    if (state.proposedChanges.some(c => c.type === 'consolidate')) {
      nextSteps.push("Confirm meeting consolidations with attendees");
    }
    if (state.proposedChanges.some(c => c.type === 'move')) {
      nextSteps.push("Check availability for rescheduled meetings");
    }
    
    return {
      messages: [
        ...state.messages,
        new AIMessage(summary)
      ],
      data: {
        ...state.data,
        summary,
      }
    };
  } catch (error) {
    console.error(`[${WORKFLOW_NAME}] Error in generateProposal:`, error);
    return {
      messages: [
        ...state.messages,
        new AIMessage("Calendar optimization complete")
      ]
    };
  }
}

// Helper function to generate summary
function generateCalendarSummary(state: CalendarState): string {
  const parts: string[] = [];
  
  parts.push(`Analyzed ${state.data.meetings.length} meetings`);
  
  if (state.data.conflicts.length > 0) {
    parts.push(`found ${state.data.conflicts.length} conflicts`);
  }
  
  if (state.data.inefficiencies.length > 0) {
    parts.push(`${state.data.inefficiencies.length} optimization opportunities`);
  }
  
  const moves = state.proposedChanges.filter(c => c.type === 'move').length;
  const consolidations = state.proposedChanges.filter(c => c.type === 'consolidate').length;
  
  if (moves > 0) {
    parts.push(`${moves} meetings to reschedule`);
  }
  
  if (consolidations > 0) {
    parts.push(`${consolidations} meetings to consolidate`);
  }
  
  return parts.join(', ') + '.';
}
*/ 