import { withRetry, isNetworkError } from './retry';
import { queueForOffline } from './offline-queue';

export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export interface ErrorHandlingOptions {
  enableRetry?: boolean;
  enableOfflineQueue?: boolean;
  logErrors?: boolean;
}

export function createErrorHandlingProxy<T extends object>(
  target: T,
  serviceName: string,
  options: ErrorHandlingOptions = {}
): T {
  const {
    enableRetry = true,
    enableOfflineQueue = true,
    logErrors = true
  } = options;

  return new Proxy(target, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      
      if (typeof original !== 'function') {
        return original;
      }
      
      return async (...args: any[]) => {
        const methodName = String(prop);
        
        try {
          // Wrap in retry logic if enabled
          if (enableRetry) {
            return await withRetry(
              () => original.apply(target, args),
              {
                shouldRetry: (error) => isNetworkError(error)
              }
            );
          } else {
            return await original.apply(target, args);
          }
        } catch (error) {
          // Log error if enabled
          if (logErrors) {
            console.error(`[${serviceName}] Error in ${methodName}:`, error);
          }
          
          // Queue for offline if network error and queueing is enabled
          if (enableOfflineQueue && isNetworkError(error)) {
            await queueForOffline({
              service: serviceName,
              method: methodName,
              args,
              timestamp: new Date().toISOString()
            });
            
            throw new ServiceError(
              `Operation queued for offline execution: ${methodName}`,
              'OFFLINE_QUEUED',
              error
            );
          }
          
          // Transform error to ServiceError
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorCode = (error as any)?.code || 'SERVICE_ERROR';
          
          throw new ServiceError(
            `${serviceName}.${methodName} failed: ${errorMessage}`,
            errorCode,
            error
          );
        }
      };
    }
  });
} 