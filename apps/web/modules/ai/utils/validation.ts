import { z } from 'zod';
import { universalToolResponseSchema } from '../schemas/universal.schema';

/**
 * Validates a tool response against the universal schema
 */
export function validateToolResponse(response: unknown): z.infer<typeof universalToolResponseSchema> | null {
  try {
    return universalToolResponseSchema.parse(response);
  } catch (error) {
    console.error('[Validation] Invalid tool response:', error);
    return null;
  }
}

/**
 * Checks if a response is a valid structured response
 */
export function isStructuredResponse(response: unknown): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }
  
  const obj = response as any;
  
  // Check for required fields
  return (
    obj.metadata &&
    typeof obj.metadata === 'object' &&
    obj.metadata.toolName &&
    obj.metadata.operation &&
    obj.metadata.resourceType &&
    obj.display &&
    typeof obj.display === 'object'
  );
}

/**
 * Validates and repairs partial tool responses during streaming
 */
export function validatePartialResponse(partial: unknown): Partial<z.infer<typeof universalToolResponseSchema>> | null {
  if (!partial || typeof partial !== 'object') {
    return null;
  }
  
  try {
    // Use partial schema validation
    return universalToolResponseSchema.partial().parse(partial);
  } catch {
    // If validation fails, return the partial as-is for best effort
    return partial as any;
  }
}

/**
 * Merges partial responses during streaming
 */
export function mergePartialResponses(
  current: Partial<z.infer<typeof universalToolResponseSchema>>,
  update: Partial<z.infer<typeof universalToolResponseSchema>>
): Partial<z.infer<typeof universalToolResponseSchema>> {
  return {
    ...current,
    ...update,
    metadata: {
      ...current.metadata,
      ...update.metadata,
    } as any,
    display: {
      ...current.display,
      ...update.display,
      components: update.display?.components || current.display?.components,
    } as any,
    ui: {
      ...current.ui,
      ...update.ui,
      actions: update.ui?.actions || current.ui?.actions,
      suggestions: update.ui?.suggestions || current.ui?.suggestions,
    } as any,
    streaming: {
      ...current.streaming,
      ...update.streaming,
    } as any,
  };
} 