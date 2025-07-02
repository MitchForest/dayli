/**
 * Example: Using Error Recovery with Tools
 * 
 * This file demonstrates how to integrate the error recovery utility
 * with AI tools for automatic retry and partial success handling.
 */

import { executeWithRecovery, withRecovery, executeWithPartialSuccess, ErrorCategory } from './error-recovery';
import { type UniversalToolResponse } from '../schemas/universal.schema';

// Example 1: Wrapping a tool with automatic retry
export async function createTaskWithRetry(params: {
  title: string;
  description?: string;
  estimatedMinutes?: number;
}): Promise<UniversalToolResponse> {
  return executeWithRecovery(
    async () => {
      // Simulate a tool that might fail
      const response = await fetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Return UniversalToolResponse
      return {
        metadata: {
          toolName: 'createTask',
          operation: 'create' as const,
          resourceType: 'task' as const,
          timestamp: new Date().toISOString(),
          executionTime: 100,
        },
        data,
        display: {
          type: 'card' as const,
          title: 'Task Created',
          description: `Created task: ${params.title}`,
          priority: 'medium' as const,
          components: [],
        },
        ui: {
          suggestions: [],
          actions: [],
          confirmationRequired: false,
        },
      };
    },
    {
      toolName: 'createTask',
      operation: 'create',
      resourceType: 'task',
      startTime: Date.now(),
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt} after error:`, error.message);
      },
    }
  );
}

// Example 2: Creating a recovery-enabled tool function
export const sendEmailWithRecovery = withRecovery(
  'sendEmail',
  'execute',
  'email',
  async (params: { to: string; subject: string; body: string }) => {
    // Tool implementation
    const response = await fetch('/api/email/send', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      throw new Error(`Email send failed: ${response.statusText}`);
    }
    
    return {
      metadata: {
        toolName: 'sendEmail',
        operation: 'execute' as const,
        resourceType: 'email' as const,
        timestamp: new Date().toISOString(),
        executionTime: 200,
      },
      data: await response.json(),
      display: {
        type: 'card' as const,
        title: 'Email Sent',
        description: `Email sent to ${params.to}`,
        priority: 'low' as const,
        components: [],
      },
      ui: {
        suggestions: [],
        actions: [],
        confirmationRequired: false,
      },
    } as UniversalToolResponse;
  },
  {
    maxAttempts: 5, // More retries for email
    retryableErrors: [ErrorCategory.NETWORK, ErrorCategory.TIMEOUT],
  }
);

// Example 3: Batch operations with partial success
export async function batchCreateTasks(tasks: Array<{
  title: string;
  description?: string;
}>) {
  const result = await executeWithPartialSuccess(
    tasks,
    async (task) => {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create task "${task.title}"`);
      }
      
      return response.json();
    },
    {
      continueOnError: true, // Continue even if some tasks fail
      maxConcurrent: 3, // Process 3 tasks at a time
    }
  );
  
  console.log(`Successfully created ${result.successful.length} tasks`);
  console.log(`Failed to create ${result.failed.length} tasks`);
  
  // Handle failed tasks
  result.failed.forEach(({ item, error, category }) => {
    console.error(`Task "${item.title}" failed:`, error.message);
    console.log(`Error category: ${category}`);
    
    // Could retry specific categories
    if (category === ErrorCategory.NETWORK) {
      console.log('Network error - could retry later');
    }
  });
  
  return result;
}

// Example 4: Custom error handling based on category
export async function smartTaskCreation(params: any) {
  try {
    return await createTaskWithRetry(params);
  } catch (error) {
    // The error response from executeWithRecovery includes category info
    if (error && typeof error === 'object' && 'error' in error) {
      const errorResponse = error as UniversalToolResponse;
      const category = errorResponse.error?.details?.errorCategory;
      
      switch (category) {
        case ErrorCategory.AUTHENTICATION:
          // Redirect to login
          console.log('User needs to authenticate');
          break;
          
        case ErrorCategory.PERMISSION:
          // Show permission error
          console.log('User lacks permission for this action');
          break;
          
        case ErrorCategory.VALIDATION:
          // Show validation errors
          console.log('Invalid input provided');
          break;
          
        default:
          // Generic error handling
          console.log('Operation failed:', errorResponse.error?.message);
      }
    }
    
    throw error;
  }
} 