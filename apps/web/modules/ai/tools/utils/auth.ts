import { ServiceFactory } from '@/services/factory/service.factory';

/**
 * Ensures that ServiceFactory is properly configured before tool execution.
 * This should be called at the start of every tool's execute function.
 * 
 * @throws Error if ServiceFactory is not configured (user not authenticated)
 */
export async function ensureServicesConfigured(): Promise<void> {
  const factory = ServiceFactory.getInstance();
  
  if (!factory.isConfigured()) {
    // This should not happen in production as ServiceFactory
    // is initialized in providers.tsx on auth state change
    throw new Error(
      'ServiceFactory not configured. This usually means the user is not authenticated.'
    );
  }
}

/**
 * Helper to check if services are configured without throwing
 * Useful for conditional logic in tools
 */
export function isServicesConfigured(): boolean {
  const factory = ServiceFactory.getInstance();
  return factory.isConfigured();
} 