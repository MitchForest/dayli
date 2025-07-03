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

export interface FindGapsResponse extends BaseToolResponse {
  gaps: Array<{
    startTime: string;
    endTime: string;
    duration: number;
  }>;
  totalAvailableMinutes: number;
}

export interface BatchCreateBlocksResponse extends BaseToolResponse {
  created: Array<{
    id: string;
    type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
  }>;
  conflicts: Array<{
    block: {
      type: string;
      title: string;
      startTime: string;
      endTime: string;
    };
    reason: string;
    conflictsWith?: string;
  }>;
  totalRequested: number;
  totalCreated: number;
}

export interface AnalyzeUtilizationResponse extends BaseToolResponse {
  utilization: number;
  totalScheduledMinutes: number;
  focusTime: number;
  meetingTime: number;
  breakTime: number;
  emailTime: number;
  fragmentedTime: number;
  longestWorkBlock: number;
  suggestions: string[];
  blockCount: number;
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
export interface ScheduleResponse extends BaseToolResponse {
  date: string;
  blocks: Array<{
    id: string;
    type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
    title: string;
    startTime: string;
    endTime: string;
    duration: number;
    isProtected?: boolean;
  }>;
  changes: Array<{
    action: string;
    block: string;
    reason: string;
  }>;
  summary: string;
}

export interface WorkflowScheduleResponse extends BaseToolResponse {
  phase: 'proposal' | 'completed' | 'execution';
  requiresConfirmation?: boolean;
  proposalId?: string;
  date: string;
  blocks: Array<{
    id?: string;
    type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
  }>;
  changes: Array<{
    action: string;
    block: string;
    reason: string;
  }>;
  summary: string;
  message?: string;
  utilizationBefore?: number;
  utilizationAfter?: number;
  created?: Array<{
    id: string;
    type: 'work' | 'meeting' | 'email' | 'break' | 'blocked';
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
  }>;
  conflicts?: Array<{
    block: {
      type: string;
      title: string;
      startTime: string;
      endTime: string;
    };
    reason: string;
    conflictsWith?: string;
  }>;
}

export interface WorkflowFillWorkBlockResponse extends BaseToolResponse {
  phase: 'proposal' | 'completed';
  requiresConfirmation?: boolean;
  proposalId?: string;
  blockId: string;
  blockTitle?: string;
  proposals?: {
    combination: Array<{
      id: string;
      title: string;
      estimatedMinutes: number;
      priority: 'low' | 'medium' | 'high';
    }>;
    totalMinutes: number;
    totalScore: number;
    reasoning: string;
  };
  message?: string;
  assigned?: string[];
  summary: string;
}

export interface WorkflowFillEmailBlockResponse extends BaseToolResponse {
  phase: 'proposal' | 'completed';
  requiresConfirmation?: boolean;
  proposalId?: string;
  blockId: string;
  blockDuration?: number;
  proposals?: {
    urgent: Array<{
      emailId: string;
      category: string;
      urgencyScore: number;
    }>;
    batched: Array<{
      sender: string;
      senderEmail: string;
      count: number;
      emailIds: string[];
    }>;
    toArchive: string[];
  };
  message?: string;
  processed?: number;
  archived?: number;
  summary: string;
}

export interface FillEmailBlockResponse extends BaseToolResponse {
  blockId: string;
  urgent: Array<{
    id: string;
    from: string;
    subject: string;
    reason: string;
    actionType?: 'quick_reply' | 'thoughtful_response';
    daysInBacklog?: number;
  }>;
  batched: Array<{
    sender: string;
    count: number;
    emails: Array<{
      id: string;
      subject: string;
    }>;
  }>;
  archived: number;
  totalToProcess: number;
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

export interface ViewTasksResponse extends BaseToolResponse {
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'completed';
    priority: 'low' | 'medium' | 'high';
    estimatedMinutes?: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
}

export interface GetBacklogWithScoresResponse extends BaseToolResponse {
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high';
    status: string;
    estimatedMinutes: number;
    dueDate?: string;
    daysInBacklog: number;
    score: number;
    scoreBreakdown: {
      priority: number;
      age: number;
      urgency: number;
    };
  }>;
  totalTasks: number;
  averageScore: number;
}

export interface AssignToTimeBlockResponse extends BaseToolResponse {
  assigned: string[];
  failed: Array<{
    taskId: string;
    reason: string;
  }>;
  blockId: string;
  totalRequested: number;
  totalAssigned: number;
}

export interface SuggestForDurationResponse extends BaseToolResponse {
  suggestions: Array<{
    combination: Array<{
      id: string;
      title: string;
      estimatedMinutes: number;
      priority: 'low' | 'medium' | 'high';
    }>;
    totalMinutes: number;
    totalScore: number;
    reasoning: string;
  }>;
  availableDuration: number;
  totalTasksConsidered: number;
}

// Email tool responses
export interface ViewEmailsResponse extends BaseToolResponse {
  emails: Array<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    isUnread: boolean;
    hasAttachments: boolean;
  }>;
  totalEmails: number;
  unreadCount: number;
}

export interface GetEmailBacklogResponse extends BaseToolResponse {
  emails: Array<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    receivedAt: string;
    status: 'unread' | 'backlog';
    hasAttachments: boolean;
    threadId: string;
    labelIds: string[];
  }>;
  total: number;
  hasMore: boolean;
}

export interface CategorizeEmailResponse extends BaseToolResponse {
  category: 'needs_reply' | 'important_info' | 'potential_task' | 'can_archive';
  confidence: number;
  suggestedAction: string;
  urgencyScore: number;
}

export interface BatchCategorizeResponse extends BaseToolResponse {
  categorized: Array<{
    emailId: string;
    category: 'needs_reply' | 'important_info' | 'potential_task' | 'can_archive';
    urgencyScore: number;
  }>;
  failed: Array<{
    emailId: string;
    reason: string;
  }>;
  totalProcessed: number;
  totalFailed: number;
}

export interface GroupBySenderResponse extends BaseToolResponse {
  groups: Array<{
    sender: string;
    senderEmail: string;
    count: number;
    emailIds: string[];
  }>;
  totalGroups: number;
  totalGroupedEmails: number;
  ungroupedEmails: number;
}

export interface ArchiveBatchResponse extends BaseToolResponse {
  archived: number;
  failed: string[];
  archivedIds: string[];
}

export interface CreateTaskFromEmailResponse extends BaseToolResponse {
  task: {
    id: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    source: 'email';
    emailId: string;
  };
}