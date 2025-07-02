import { type UniversalToolResponse } from '../schemas/universal.schema';
import { format } from 'date-fns';

interface BuildResponseOptions {
  toolName: string;
  operation: UniversalToolResponse['metadata']['operation'];
  resourceType: UniversalToolResponse['metadata']['resourceType'];
  startTime: number;
}

export function buildToolResponse(
  options: BuildResponseOptions,
  data: any,
  display: UniversalToolResponse['display'],
  ui: Partial<UniversalToolResponse['ui']> = {},
  streaming?: UniversalToolResponse['streaming']
): UniversalToolResponse {
  return {
    metadata: {
      toolName: options.toolName,
      operation: options.operation,
      resourceType: options.resourceType,
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - options.startTime,
    },
    data,
    display,
    ui: {
      suggestions: [],
      actions: [],
      confirmationRequired: false,
      ...ui,
    },
    streaming,
  };
}

export function buildErrorResponse(
  options: BuildResponseOptions,
  error: any,
  display?: Partial<UniversalToolResponse['display']>
): UniversalToolResponse {
  const errorMessage = error?.message || 'An unknown error occurred';
  const errorCode = error?.code || 'UNKNOWN_ERROR';
  
  return {
    metadata: {
      toolName: options.toolName,
      operation: options.operation,
      resourceType: options.resourceType,
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - options.startTime,
    },
    data: null,
    display: {
      type: 'card',
      title: display?.title || 'Operation Failed',
      description: display?.description || errorMessage,
      priority: 'high',
      components: [],
      ...display,
    },
    ui: {
      notification: {
        show: true,
        type: 'error',
        message: errorMessage,
        duration: 5000,
      },
      suggestions: ['Try again', 'Check your input'],
      actions: [],
      confirmationRequired: false,
    },
    error: {
      code: errorCode,
      message: errorMessage,
      details: error,
      recoverable: true,
      suggestedActions: getSuggestedActions(errorCode, options.resourceType),
    },
  };
}

function getSuggestedActions(errorCode: string, resourceType: string): string[] {
  const baseActions = ['Retry the operation', 'Check your permissions'];
  
  switch (resourceType) {
    case 'schedule':
      return [...baseActions, 'Check for time conflicts', 'Verify time format'];
    case 'task':
      return [...baseActions, 'Verify task exists', 'Check task status'];
    case 'email':
      return [...baseActions, 'Check email connection', 'Verify email ID'];
    case 'meeting':
      return [...baseActions, 'Check calendar availability', 'Verify attendee emails'];
    default:
      return baseActions;
  }
}

// Time formatting helpers
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

export function formatTime12Hour(date: Date): string {
  return format(date, 'h:mm a');
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
} 