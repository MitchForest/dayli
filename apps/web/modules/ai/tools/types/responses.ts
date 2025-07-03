// Pure data types returned by tools - no UI instructions

export interface BaseToolResponse {
  success: boolean;
  error?: string;
  timestamp?: Date;
}

// Schedule tool responses
export interface ScheduleViewResponse extends BaseToolResponse {
  date: string;
  blocks: Array<{
    id: string;
    type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    tasks?: Array<{
      id: string;
      title: string;
      completed: boolean;
      estimatedMinutes?: number;
    }>;
  }>;
  stats: {
    totalHours: number;
    focusHours: number;
    meetingHours: number;
    utilization: number;
  };
}

export interface CreateTimeBlockResponse extends BaseToolResponse {
  block: {
    id: string;
    type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
  };
  conflicts?: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
  }>;
}

export interface MoveTimeBlockResponse extends BaseToolResponse {
  block: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    type: string;
  };
  previousTime: {
    startTime: Date;
    endTime: Date;
  };
}

export interface DeleteTimeBlockResponse extends BaseToolResponse {
  deletedBlockId: string;
  deletedBlockTitle: string;
}

export interface FillWorkBlockResponse extends BaseToolResponse {
  blockId: string;
  assignedTasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    priority: string;
    score?: number;
  }>;
  utilization: number;
  remainingMinutes: number;
}

// Task tool responses
export interface TaskListResponse extends BaseToolResponse {
  tasks: Array<{
    id: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    status: 'active' | 'completed' | 'backlog';
    score?: number;
    estimatedMinutes?: number;
    daysInBacklog?: number;
    description?: string;
    dueDate?: Date;
  }>;
  stats: {
    total: number;
    completed: number;
    highPriority: number;
    totalEstimatedHours: number;
  };
}

export interface CreateTaskResponse extends BaseToolResponse {
  task: {
    id: string;
    title: string;
    priority: string;
    estimatedMinutes?: number;
    description?: string;
    status: string;
  };
}

export interface UpdateTaskResponse extends BaseToolResponse {
  task: {
    id: string;
    title: string;
    priority: string;
    status: string;
    updatedFields: string[];
  };
}

export interface CompleteTaskResponse extends BaseToolResponse {
  taskId: string;
  title: string;
  completedAt: Date;
}

// Email tool responses
export interface EmailListResponse extends BaseToolResponse {
  emails: Array<{
    id: string;
    from: string;
    fromEmail: string;
    subject: string;
    snippet: string;
    receivedAt: Date;
    isRead: boolean;
    hasAttachments: boolean;
    urgency?: 'urgent' | 'important' | 'normal';
    status: string;
  }>;
  stats: {
    total: number;
    unread: number;
    urgent: number;
  };
}

export interface ReadEmailResponse extends BaseToolResponse {
  email: {
    id: string;
    from: string;
    fromEmail: string;
    to: string;
    subject: string;
    body: string;
    receivedAt: Date;
    attachments?: Array<{
      filename: string;
      mimeType: string;
      size: number;
    }>;
    extractedActions?: string[];
  };
}

export interface ProcessEmailResponse extends BaseToolResponse {
  emailId: string;
  action: 'draft' | 'send' | 'convert_to_task';
  result: {
    draftId?: string;
    draftContent?: string;
    taskId?: string;
    taskTitle?: string;
  };
}

// Calendar tool responses
export interface ScheduleMeetingResponse extends BaseToolResponse {
  meeting: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    attendees: string[];
    location?: string;
    description?: string;
  };
  prepBlockCreated?: boolean;
}

export interface RescheduleMeetingResponse extends BaseToolResponse {
  meetingId: string;
  previousTime: {
    startTime: Date;
    endTime: Date;
  };
  newTime: {
    startTime: Date;
    endTime: Date;
  };
  notificationsSent: boolean;
}

// Preference tool response
export interface UpdatePreferencesResponse extends BaseToolResponse {
  key: string;
  previousValue: any;
  newValue: any;
}

// Workflow responses
export interface OptimizeScheduleResponse extends BaseToolResponse {
  date: string;
  proposalId?: string;
  changes: Array<{
    type: 'create' | 'move' | 'delete' | 'modify';
    description: string;
    impact: string;
  }>;
  optimizedSchedule?: Array<{
    id: string;
    type: string;
    title: string;
    startTime: Date;
    endTime: Date;
  }>;
  metrics: {
    utilizationBefore: number;
    utilizationAfter: number;
    focusTimeBefore: number;
    focusTimeAfter: number;
  };
}

export interface TriageEmailsResponse extends BaseToolResponse {
  proposalId?: string;
  emailBatches: Array<{
    category: string;
    emails: Array<{
      id: string;
      subject: string;
      from: string;
      suggestedAction: string;
    }>;
  }>;
  suggestedActions: Array<{
    type: 'draft' | 'archive' | 'convert_to_task';
    count: number;
    emails: string[];
  }>;
}

export interface PrioritizeTasksResponse extends BaseToolResponse {
  rankedTasks: Array<{
    id: string;
    title: string;
    score: number;
    reason: string;
    suggestedTimeBlock?: string;
  }>;
  insights: {
    overdueCount: number;
    highPriorityCount: number;
    quickWinsCount: number;
  };
}

export interface OptimizeCalendarResponse extends BaseToolResponse {
  proposalId?: string;
  suggestions: Array<{
    type: 'consolidate' | 'reschedule' | 'cancel' | 'shorten';
    meetings: string[];
    reason: string;
    impact: string;
  }>;
  potentialTimeSaved: number;
}

// System tool responses
export interface ConfirmProposalResponse extends BaseToolResponse {
  proposalId: string;
  executed: boolean;
  changes: Array<{
    type: string;
    description: string;
    result: 'success' | 'failed';
  }>;
}

export interface WorkflowHistoryResponse extends BaseToolResponse {
  workflows: Array<{
    id: string;
    type: string;
    executedAt: Date;
    status: 'completed' | 'failed' | 'interrupted';
    changes?: number;
    outcome?: string;
  }>;
}

export interface ResumeWorkflowResponse extends BaseToolResponse {
  workflowId: string;
  resumed: boolean;
  result?: any;
}

export interface ProvideFeedbackResponse extends BaseToolResponse {
  feedbackId: string;
  recorded: boolean;
}

export interface ShowPatternsResponse extends BaseToolResponse {
  patterns: Array<{
    category: string;
    pattern: string;
    confidence: number;
    examples: string[];
  }>;
}

export interface ClearContextResponse extends BaseToolResponse {
  cleared: boolean;
  scope: 'conversation' | 'all';
}