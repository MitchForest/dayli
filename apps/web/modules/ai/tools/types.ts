export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    duration?: number;
    affectedItems?: string[];
    suggestions?: string[];
    confirmationRequired?: boolean;
    confirmationId?: string;
  };
  display?: {
    type: 'text' | 'list' | 'schedule' | 'email' | 'task' | 'confirmation';
    content: any;
  };
  streaming?: {
    progress: number; // 0-100
    message: string;
    partialData?: T;
  };
}

// Helper functions for consistent returns
export function toolSuccess<T>(
  data: T, 
  display?: ToolResult['display'],
  metadata?: ToolResult['metadata']
): ToolResult<T> {
  return { 
    success: true, 
    data, 
    display,
    metadata
  };
}

export function toolError(
  code: string, 
  message: string,
  details?: any
): ToolResult {
  return { 
    success: false, 
    error: { code, message, details } 
  };
}

export function toolConfirmation<T>(
  data: T,
  confirmationId: string,
  message: string
): ToolResult<T> {
  return {
    success: true,
    data,
    metadata: {
      confirmationRequired: true,
      confirmationId
    },
    display: {
      type: 'confirmation',
      content: { message, data }
    }
  };
}

export function toolStreaming<T>(
  progress: number,
  message: string,
  partialData?: T
): ToolResult<T> {
  return {
    success: true,
    streaming: {
      progress,
      message,
      partialData
    }
  };
}

// Common types for tools
export interface ProposedChange {
  type: 'create' | 'move' | 'delete' | 'assign' | 'update';
  description?: string;
  block?: {
    id?: string;
    type: string;
    title: string;
    startTime: string;
    endTime?: string;
  };
  task?: {
    id: string;
    title: string;
  };
  newStartTime?: string;
  newEndTime?: string;
}

export interface TimeBlock {
  id: string;
  type: 'work' | 'email' | 'break' | 'meeting' | 'blocked';
  title: string;
  startTime: Date | string;
  endTime: Date | string;
  date?: string;
  description?: string;
  taskIds?: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: string;
  estimatedMinutes?: number;
  completedAt?: Date | null;
  source?: string;
  metadata?: Record<string, string>;
} 