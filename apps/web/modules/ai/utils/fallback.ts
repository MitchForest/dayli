import type { UniversalToolResponse } from '../schemas/universal.schema';

/**
 * Creates a fallback response when structured data isn't available
 */
export function createFallbackResponse(
  toolName: string,
  content: string,
  error?: any
): UniversalToolResponse {
  const isError = !!error;
  
  return {
    metadata: {
      toolName,
      operation: 'read',
      resourceType: 'workflow',
      timestamp: new Date().toISOString(),
      executionTime: 0,
    },
    
    data: null,
    
    display: {
      type: 'card',
      title: isError ? 'Operation Failed' : 'Operation Result',
      description: content,
      priority: isError ? 'high' : 'medium',
      components: [],
    },
    
    ui: {
      notification: isError ? {
        show: true,
        type: 'error',
        message: error?.message || content,
        duration: 5000,
      } : undefined,
      suggestions: isError ? ['Try again', 'Check your input'] : [],
      actions: [],
      confirmationRequired: false,
    },
    
    error: isError ? {
      code: error?.code || 'FALLBACK_ERROR',
      message: error?.message || content,
      details: error,
      recoverable: true,
      suggestedActions: ['Retry the operation', 'Check the logs'],
    } : undefined,
  };
}

/**
 * Converts legacy text responses to structured format
 */
export function convertLegacyResponse(
  toolName: string,
  textResponse: string
): UniversalToolResponse | null {
  // Try to parse common patterns
  const patterns = {
    schedule: /schedule|block|time|meeting/i,
    task: /task|todo|complete|assign/i,
    email: /email|message|draft|reply/i,
    preference: /preference|setting|config/i,
  };

  let resourceType: 'schedule' | 'task' | 'email' | 'preference' | 'workflow' = 'workflow';
  
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(textResponse)) {
      resourceType = type as any;
      break;
    }
  }

  // Extract any data that looks like JSON
  let extractedData = null;
  try {
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      extractedData = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Ignore JSON parse errors
  }

  return {
    metadata: {
      toolName,
      operation: 'read',
      resourceType,
      timestamp: new Date().toISOString(),
      executionTime: 0,
    },
    
    data: extractedData,
    
    display: {
      type: 'card',
      title: 'Legacy Response',
      description: textResponse,
      priority: 'low',
      components: [],
    },
    
    ui: {
      suggestions: [],
      actions: [],
      confirmationRequired: false,
    },
  };
}

/**
 * Handles cases where tool execution fails completely
 */
export function handleToolFailure(
  toolName: string,
  error: Error
): UniversalToolResponse {
  return {
    metadata: {
      toolName,
      operation: 'read',
      resourceType: 'workflow',
      timestamp: new Date().toISOString(),
      executionTime: 0,
    },
    
    data: null,
    
    display: {
      type: 'card',
      title: 'Tool Execution Failed',
      description: `Failed to execute ${toolName}`,
      priority: 'high',
      components: [],
    },
    
    ui: {
      notification: {
        show: true,
        type: 'error',
        message: `Tool execution failed: ${error.message}`,
        duration: 5000,
      },
      suggestions: [
        'Try again',
        'Check your input',
        'Report this issue',
      ],
      actions: [{
        id: 'retry',
        label: 'Retry',
        icon: 'refresh',
        variant: 'primary',
        action: {
          type: 'message',
          message: 'Please try the operation again',
        },
      }],
      confirmationRequired: false,
    },
    
    error: {
      code: 'TOOL_EXECUTION_FAILED',
      message: error.message,
      details: error.stack,
      recoverable: true,
      suggestedActions: [
        'Check the tool parameters',
        'Ensure you have the necessary permissions',
        'Try a different approach',
      ],
    },
  };
} 