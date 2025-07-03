import { tool as aiTool } from 'ai';
import { z } from 'zod';

// Base interface for all tool responses
export interface BaseToolResponse {
  success: boolean;
  error?: string;
  timestamp?: Date;
}

// Tool metadata for better organization
export interface ToolMetadata {
  category: 'schedule' | 'task' | 'email' | 'calendar' | 'preference' | 'workflow' | 'system';
  displayName: string;
  requiresConfirmation?: boolean;
  supportsStreaming?: boolean;
}

// Factory function for creating consistent tools
export function createTool<TParams extends z.ZodType, TResponse extends BaseToolResponse>(
  config: {
    name: string;
    description: string;
    parameters: TParams;
    metadata: ToolMetadata;
    execute: (params: z.infer<TParams>) => Promise<TResponse>;
  }
) {
  // Add consistent error handling and logging
  const wrappedExecute = async (params: z.infer<TParams>): Promise<TResponse> => {
    const startTime = Date.now();
    try {
      console.log(`[Tool: ${config.name}] Starting execution`, { params });
      
      const result = await config.execute(params);
      
      // Ensure consistent response structure
      const response = {
        ...result,
        success: result.success ?? true,
        timestamp: new Date(),
      };
      
      console.log(`[Tool: ${config.name}] Completed in ${Date.now() - startTime}ms`);
      return response;
      
    } catch (error) {
      console.error(`[Tool: ${config.name}] Error:`, error);
      
      // Return consistent error response
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      } as TResponse;
    }
  };
  
  // Create the AI SDK tool
  const tool = aiTool({
    description: config.description,
    parameters: config.parameters,
    execute: wrappedExecute,
  });
  
  // Attach metadata for runtime access
  (tool as any).__metadata = config.metadata;
  (tool as any).__name = config.name;
  
  return tool;
}

// Type guard to check if a tool supports streaming
export function supportsStreaming(tool: any): boolean {
  return tool.__metadata?.supportsStreaming === true;
}

// Get tool category for display routing
export function getToolCategory(tool: any): string {
  return tool.__metadata?.category || 'unknown';
}

// Get tool display name
export function getToolDisplayName(tool: any): string {
  return tool.__metadata?.displayName || tool.__name || 'Unknown Tool';
}