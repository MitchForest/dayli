import { type UniversalToolResponse } from '../schemas/universal.schema';
import { buildErrorResponse } from './tool-helpers';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RecoveryContext {
  toolName: string;
  operation: 'create' | 'read' | 'update' | 'delete' | 'execute';
  resourceType: 'schedule' | 'task' | 'email' | 'meeting' | 'preference' | 'workflow';
  startTime: number;
}

// Error categories
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

// Default retryable error categories
const DEFAULT_RETRYABLE_CATEGORIES = [
  ErrorCategory.NETWORK,
  ErrorCategory.RATE_LIMIT,
  ErrorCategory.TIMEOUT,
  ErrorCategory.SERVER,
];

/**
 * Categorize an error based on its message and properties
 */
export function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const errorCode = (error as any).code?.toLowerCase();
  
  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    errorCode === 'network_error'
  ) {
    return ErrorCategory.NETWORK;
  }
  
  // Authentication errors
  if (
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('no authenticated user') ||
    errorCode === '401'
  ) {
    return ErrorCategory.AUTHENTICATION;
  }
  
  // Permission errors
  if (
    message.includes('forbidden') ||
    message.includes('permission') ||
    message.includes('access denied') ||
    errorCode === '403'
  ) {
    return ErrorCategory.PERMISSION;
  }
  
  // Validation errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required') ||
    errorCode === '400'
  ) {
    return ErrorCategory.VALIDATION;
  }
  
  // Rate limit errors
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    errorCode === '429'
  ) {
    return ErrorCategory.RATE_LIMIT;
  }
  
  // Timeout errors
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    errorCode === 'timeout'
  ) {
    return ErrorCategory.TIMEOUT;
  }
  
  // Not found errors
  if (
    message.includes('not found') ||
    message.includes('does not exist') ||
    errorCode === '404'
  ) {
    return ErrorCategory.NOT_FOUND;
  }
  
  // Conflict errors
  if (
    message.includes('conflict') ||
    message.includes('already exists') ||
    errorCode === '409'
  ) {
    return ErrorCategory.CONFLICT;
  }
  
  // Server errors
  if (
    message.includes('internal server') ||
    message.includes('server error') ||
    errorCode?.startsWith('5')
  ) {
    return ErrorCategory.SERVER;
  }
  
  return ErrorCategory.UNKNOWN;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with automatic retry and error recovery
 */
export async function executeWithRecovery<T extends UniversalToolResponse>(
  fn: () => Promise<T>,
  context: RecoveryContext,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryableErrors = [],
    onRetry,
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Execute the function
      const result = await fn();
      
      // If successful, return the result
      return result;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorCategory = categorizeError(lastError);
      
      console.error(`[ERROR RECOVERY] Attempt ${attempt}/${maxAttempts} failed:`, {
        toolName: context.toolName,
        category: errorCategory,
        message: lastError.message,
      });
      
      // Check if we should retry
      const shouldRetry = 
        attempt < maxAttempts &&
        (DEFAULT_RETRYABLE_CATEGORIES.includes(errorCategory) ||
         retryableErrors.includes(errorCategory));
      
      if (shouldRetry) {
        // Calculate delay
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
        
        // Call retry callback if provided
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        console.log(`[ERROR RECOVERY] Retrying in ${delay}ms...`);
        await sleep(delay);
        
      } else {
        // No more retries, break the loop
        break;
      }
    }
  }
  
  // All attempts failed, return error response
  const errorCategory = lastError ? categorizeError(lastError) : ErrorCategory.UNKNOWN;
  const isRetryable = DEFAULT_RETRYABLE_CATEGORIES.includes(errorCategory);
  
  const errorResponse = buildErrorResponse(
    context,
    lastError || new Error('Unknown error'),
    {
      title: 'Operation Failed',
      description: isRetryable 
        ? 'The operation failed after multiple attempts. Please try again later.'
        : 'The operation failed and cannot be retried automatically.',
    }
  );
  
  // Add additional metadata to the error response
  if (errorResponse.error) {
    errorResponse.error.details = {
      ...errorResponse.error.details,
      errorCategory,
      attempts: maxAttempts,
      retryable: isRetryable,
    };
  }
  
  return errorResponse as T;
}

/**
 * Wrapper for partial success handling
 */
export interface PartialResult<T> {
  successful: T[];
  failed: Array<{
    item: any;
    error: Error;
    category: ErrorCategory;
  }>;
}

/**
 * Execute operations on multiple items with partial success handling
 */
export async function executeWithPartialSuccess<TItem, TResult>(
  items: TItem[],
  operation: (item: TItem) => Promise<TResult>,
  options: {
    continueOnError?: boolean;
    maxConcurrent?: number;
  } = {}
): Promise<PartialResult<TResult>> {
  const { continueOnError = true, maxConcurrent = 5 } = options;
  
  const successful: TResult[] = [];
  const failed: Array<{
    item: TItem;
    error: Error;
    category: ErrorCategory;
  }> = [];
  
  // Process items in batches
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const batch = items.slice(i, i + maxConcurrent);
    
    const results = await Promise.allSettled(
      batch.map(item => operation(item))
    );
    
    results.forEach((result, index) => {
      const item = batch[index];
      if (!item) return;
      
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        const error = result.reason instanceof Error 
          ? result.reason 
          : new Error(String(result.reason));
        
        failed.push({
          item,
          error,
          category: categorizeError(error),
        });
        
        // If not continuing on error, throw immediately
        if (!continueOnError) {
          throw error;
        }
      }
    });
  }
  
  return { successful, failed };
}

/**
 * Create a recovery-enabled version of a tool function
 */
export function withRecovery<TParams, TResult extends UniversalToolResponse>(
  toolName: string,
  operation: 'create' | 'read' | 'update' | 'delete' | 'execute',
  resourceType: 'schedule' | 'task' | 'email' | 'meeting' | 'preference' | 'workflow',
  fn: (params: TParams) => Promise<TResult>,
  options?: RetryOptions
): (params: TParams) => Promise<TResult> {
  return async (params: TParams) => {
    const context: RecoveryContext = {
      toolName,
      operation,
      resourceType,
      startTime: Date.now(),
    };
    
    return executeWithRecovery(
      () => fn(params),
      context,
      options
    );
  };
} 