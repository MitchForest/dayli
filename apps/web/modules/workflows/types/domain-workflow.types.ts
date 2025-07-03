import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { z } from 'zod';
import { Annotation as LangGraphAnnotation, messagesStateReducer } from '@langchain/langgraph';

// Change type for proposed modifications
export interface Change {
  type: 'create' | 'move' | 'delete' | 'assign' | 'update' | 'consolidate';
  entity: 'block' | 'task' | 'meeting' | 'schedule' | 'email';
  data: Record<string, any>;
  reason: string;
  impact?: Record<string, any>;
  confidence?: number;
}

// Insight type for observations and recommendations
export interface Insight {
  type: 'observation' | 'recommendation' | 'warning';
  content: string;
  confidence: number; // 0-1
  timestamp: Date;
  metadata?: Record<string, any>;
}

// RAG Context placeholder interfaces (for Sprint 03.04)
export interface UserPattern {
  id: string;
  type: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface Decision {
  id: string;
  timestamp: Date;
  action: string;
  reasoning: string;
}

export interface DayContext {
  date: string;
  summary: string;
  patterns: UserPattern[];
}

export interface RAGContext {
  patterns?: UserPattern[];
  recentDecisions?: Decision[];
  similarDays?: DayContext[];
}

// Base workflow result interface
export interface DomainWorkflowResult<T> {
  success: boolean;
  data: T;
  proposedChanges: Change[];
  insights: Insight[];
  ragContext: RAGContext;
  executionTime: number;
  nextSteps: string[];
}

// Time-related types
export interface TimeGap {
  startTime: string;
  endTime: string;
  duration: number; // minutes
}

export interface Inefficiency {
  type: 'gap' | 'fragmentation' | 'poor_timing' | 'task_mismatch';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedBlocks: string[];
}

// Email types
export interface EmailBacklog {
  id: string;
  from: string;
  subject: string;
  receivedAt: Date;
  importance: 'important' | 'not_important';
  urgency: 'urgent' | 'can_wait';
}

export interface AnalyzedEmail extends EmailBacklog {
  estimatedResponseTime: number;
  suggestedAction: string;
}

export interface EmailBatch {
  strategy: string;
  emails: AnalyzedEmail[];
  totalTime: number;
  priority: number;
}

export interface EmailPattern {
  sender: string;
  frequency: number;
  averageResponseTime: number;
  importance: 'important' | 'not_important';
}

// Task types
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
  estimatedDuration?: number;
  tags?: string[];
  assignedTo?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoredTask extends Task {
  score: number;
  factors: {
    priority: number;
    urgency: number;
    age: number;
    energy: number;
    pattern: number;
  };
  reasoning: string;
}

export interface TaskRecommendation {
  taskId: string;
  title: string;
  reason: string;
  priority: number;
  estimatedDuration: number;
}

export interface TaskPattern {
  type: 'completion' | 'time_preference' | 'task_type';
  description: string;
  data: Record<string, any>;
}

// Calendar types
export interface Meeting {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  isRecurring: boolean;
  importance: 'high' | 'medium' | 'low';
}

export interface Conflict {
  id: string;
  type: 'overlap' | 'back_to_back' | 'insufficient_break';
  meetings: string[];
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface MeetingOptimization {
  type: 'consolidate' | 'reschedule' | 'cancel';
  meetingIds: string[];
  reason: string;
  suggestedTime?: Date;
}

export interface CalendarPattern {
  type: 'meeting_cluster' | 'focus_time' | 'break_pattern';
  description: string;
  frequency: number;
  data: Record<string, any>;
}

// State Annotations using the new pattern
export const SchedulingStateAnnotation = Annotation.Root({
  userId: Annotation<string>(),
  intent: Annotation<string | undefined>(),
  ragContext: Annotation<RAGContext | undefined>(),
  startTime: Annotation<number>({
    value: (current, update) => update,
    default: () => Date.now()
  }),
  data: Annotation<{
    date: string;
    currentSchedule: any[];
    gaps: TimeGap[];
    inefficiencies: Inefficiency[];
    strategy?: "full" | "partial" | "optimize" | "task_only";
    preferences: any;
    availableTasks: Task[];
    emailBacklog: EmailBacklog[];
  }>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({
      date: '',
      currentSchedule: [],
      gaps: [],
      inefficiencies: [],
      strategy: undefined,
      preferences: null,
      availableTasks: [],
      emailBacklog: [],
    })
  }),
  proposedChanges: Annotation<Change[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  insights: Annotation<Insight[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  result: Annotation<DomainWorkflowResult<any> | null>({
    value: (current, update) => update,
    default: () => null
  })
});

export const EmailStateAnnotation = Annotation.Root({
  userId: Annotation<string>(),
  intent: Annotation<string | undefined>(),
  ragContext: Annotation<RAGContext | undefined>(),
  data: Annotation<{
    emails: EmailBacklog[];
    backlogEmails: EmailBacklog[];
    analyzedEmails: AnalyzedEmail[];
    emailBatches: EmailBatch[];
    patterns: EmailPattern[];
  }>({
    reducer: (current, update) => update,
    default: () => ({
      emails: [],
      backlogEmails: [],
      analyzedEmails: [],
      emailBatches: [],
      patterns: [],
    })
  }),
  proposedChanges: Annotation<Change[]>({
    reducer: (current, update) => update,
    default: () => []
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  })
});

export const TaskStateAnnotation = Annotation.Root({
  userId: Annotation<string>(),
  intent: Annotation<string | undefined>(),
  ragContext: Annotation<RAGContext | undefined>(),
  data: Annotation<{
    tasks: Task[];
    taskBacklog: Task[];
    scoredTasks: ScoredTask[];
    recommendations: TaskRecommendation[];
    taskPatterns: TaskPattern[];
    currentEnergy: 'high' | 'medium' | 'low';
    availableMinutes: number;
    focusArea?: string;
  }>({
    reducer: (current, update) => update,
    default: () => ({
      tasks: [],
      taskBacklog: [],
      scoredTasks: [],
      recommendations: [],
      taskPatterns: [],
      currentEnergy: 'medium',
      availableMinutes: 0,
      focusArea: undefined,
    })
  }),
  proposedChanges: Annotation<Change[]>({
    reducer: (current, update) => update,
    default: () => []
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  })
});

export const CalendarStateAnnotation = Annotation.Root({
  userId: Annotation<string>(),
  intent: Annotation<string | undefined>(),
  ragContext: Annotation<RAGContext | undefined>(),
  data: Annotation<{
    meetings: Meeting[];
    conflicts: Conflict[];
    inefficiencies: Inefficiency[];
    optimizations: MeetingOptimization[];
    patterns: CalendarPattern[];
    startDate: string;
    days: number;
  }>({
    reducer: (current, update) => update,
    default: () => ({
      meetings: [],
      conflicts: [],
      inefficiencies: [],
      optimizations: [],
      patterns: [],
      startDate: '',
      days: 1,
    })
  }),
  proposedChanges: Annotation<Change[]>({
    reducer: (current, update) => update,
    default: () => []
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  })
});

// Export state types for use in nodes
export type SchedulingState = typeof SchedulingStateAnnotation.State;
export type EmailState = typeof EmailStateAnnotation.State;
export type TaskState = typeof TaskStateAnnotation.State;
export type CalendarState = typeof CalendarStateAnnotation.State;

// Legacy types for backwards compatibility
export type SchedulingData = SchedulingState['data'];
export type EmailData = EmailState['data'];
export type TaskData = TaskState['data'];
export type CalendarData = CalendarState['data']; 