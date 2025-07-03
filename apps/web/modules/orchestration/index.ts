/**
 * Orchestration Layer Exports
 */

export { OrchestrationService } from './orchestration.service';
export { buildOrchestrationContext, enrichContextWithEmails, enrichContextWithPatterns } from './context-builder';
export type { 
  UserIntent, 
  OrchestrationContext, 
  OrchestrationResult,
  IntentCacheEntry,
  RejectionPattern 
} from './types';