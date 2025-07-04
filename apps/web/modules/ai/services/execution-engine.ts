import { CompleteContext } from '../types/complete-context';
import { CompleteUnderstanding } from '../types/complete-understanding';
import { toolRegistry } from '../tools/registry';
import { v4 as uuidv4 } from 'uuid';

/**
 * Operation tracking for reference resolution
 */
export interface TrackedOperation {
  id: string;
  timestamp: string;
  tool: string;
  params: Record<string, any>;
  result: any;
  affectedEntities: {
    blocks?: string[];
    tasks?: string[];
    emails?: string[];
    meetings?: string[];
  };
  userId: string;
}

/**
 * Result from execution
 */
export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
  };
  operation: TrackedOperation;
}

/**
 * Execution Engine - Takes AI understanding and executes tools
 * 
 * This engine is responsible for:
 * 1. Executing tools with resolved parameters
 * 2. Tracking operations for reference resolution
 * 3. Handling errors gracefully
 * 4. Managing multi-step executions
 */
export class ExecutionEngine {
  private operations: TrackedOperation[] = [];
  private readonly maxOperationHistory = 50;
  
  /**
   * Execute based on AI understanding
   */
  async execute(
    understanding: CompleteUnderstanding,
    context: CompleteContext
  ): Promise<ExecutionResult> {
    const operationId = uuidv4();
    const startTime = Date.now();
    
    try {
      console.log('[ExecutionEngine] Executing:', {
        type: understanding.execution.type,
        tool: understanding.execution.tool || understanding.execution.workflow,
        confidence: understanding.intent.confidence
      });
      
      switch (understanding.execution.type) {
        case 'single':
          return await this.executeSingle(
            understanding.execution.tool!,
            understanding.execution.parameters!,
            operationId,
            context
          );
          
        case 'workflow':
          return await this.executeWorkflow(
            understanding.execution.workflow!,
            understanding.execution.parameters!,
            operationId,
            context
          );
          
        case 'multi_step':
          return await this.executeMultiStep(
            understanding.execution.steps!,
            operationId,
            context
          );
          
        default:
          throw new Error(`Unknown execution type: ${understanding.execution.type}`);
      }
    } catch (error) {
      console.error('[ExecutionEngine] Execution failed:', error);
      
      const operation: TrackedOperation = {
        id: operationId,
        timestamp: new Date().toISOString(),
        tool: understanding.execution.tool || understanding.execution.workflow || 'unknown',
        params: understanding.execution.parameters || {},
        result: null,
        affectedEntities: {},
        userId: context.userId,
      };
      
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'EXECUTION_FAILED',
          recoverable: true,
        },
        operation,
      };
    }
  }
  
  /**
   * Execute a single tool
   */
  private async executeSingle(
    toolName: string,
    parameters: Record<string, any>,
    operationId: string,
    context: CompleteContext
  ): Promise<ExecutionResult> {
    // Get tool from registry
    const tools = toolRegistry.getAll();
    const tool = tools[toolName];
    
    if (!tool) {
      throw new Error(`Tool ${toolName} not found in registry`);
    }
    
    console.log('[ExecutionEngine] Executing tool:', toolName, 'with params:', parameters);
    
    // Execute the tool - ai SDK tools have execute method that takes params and options
    // We'll provide an empty options object since our tools don't use it
    const result = await (tool as any).execute(parameters, {});
    
    // Extract affected entities from result
    const affectedEntities = this.extractAffectedEntities(toolName, parameters, result);
    
    // Track the operation
    const operation: TrackedOperation = {
      id: operationId,
      timestamp: new Date().toISOString(),
      tool: toolName,
      params: parameters,
      result,
      affectedEntities,
      userId: context.userId,
    };
    
    this.trackOperation(operation);
    
    return {
      success: true,
      result,
      operation,
    };
  }
  
  /**
   * Execute a workflow
   */
  private async executeWorkflow(
    workflowName: string,
    parameters: Record<string, any>,
    operationId: string,
    context: CompleteContext
  ): Promise<ExecutionResult> {
    // Workflows are just special tools in our system
    return this.executeSingle(workflowName, parameters, operationId, context);
  }
  
  /**
   * Execute multiple steps
   */
  private async executeMultiStep(
    steps: Array<{
      tool: string;
      parameters: Record<string, any>;
      dependsOn?: number[];
    }>,
    operationId: string,
    context: CompleteContext
  ): Promise<ExecutionResult> {
    const results: ExecutionResult[] = [];
    const affectedEntities: TrackedOperation['affectedEntities'] = {};
    
    // Execute steps in order, respecting dependencies
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;
      
      // Check dependencies
      if (step.dependsOn && step.dependsOn.length > 0) {
        const dependencyFailed = step.dependsOn.some(depIndex => 
          depIndex < results.length && !results[depIndex]?.success
        );
        
        if (dependencyFailed) {
          console.log(`[ExecutionEngine] Skipping step ${i} due to failed dependency`);
          continue;
        }
      }
      
      // Execute the step
      const stepResult = await this.executeSingle(
        step.tool,
        step.parameters,
        `${operationId}-step-${i}`,
        context
      );
      
      results.push(stepResult);
      
      // Merge affected entities
      if (stepResult.operation.affectedEntities.blocks) {
        affectedEntities.blocks = [
          ...(affectedEntities.blocks || []),
          ...stepResult.operation.affectedEntities.blocks,
        ];
      }
      if (stepResult.operation.affectedEntities.tasks) {
        affectedEntities.tasks = [
          ...(affectedEntities.tasks || []),
          ...stepResult.operation.affectedEntities.tasks,
        ];
      }
      if (stepResult.operation.affectedEntities.emails) {
        affectedEntities.emails = [
          ...(affectedEntities.emails || []),
          ...stepResult.operation.affectedEntities.emails,
        ];
      }
      
      // Stop on failure unless it's recoverable
      if (!stepResult.success && !stepResult.error?.recoverable) {
        break;
      }
    }
    
    // Create composite operation
    const operation: TrackedOperation = {
      id: operationId,
      timestamp: new Date().toISOString(),
      tool: 'multi_step',
      params: { steps },
      result: results,
      affectedEntities,
      userId: context.userId,
    };
    
    this.trackOperation(operation);
    
    // Return success if all required steps succeeded
    const allSucceeded = results.every(r => r.success);
    
    return {
      success: allSucceeded,
      result: results,
      operation,
    };
  }
  
  /**
   * Extract affected entities from tool execution
   */
  private extractAffectedEntities(
    toolName: string,
    params: Record<string, any>,
    result: any
  ): TrackedOperation['affectedEntities'] {
    const entities: TrackedOperation['affectedEntities'] = {};
    
    // Extract based on tool type
    if (toolName.startsWith('schedule_')) {
      // Schedule tools affect blocks
      if (params.blockId) {
        entities.blocks = [params.blockId];
      } else if (result?.data?.id) {
        entities.blocks = [result.data.id];
      } else if (result?.blocks) {
        entities.blocks = result.blocks.map((b: any) => b.id);
      }
    } else if (toolName.startsWith('task_')) {
      // Task tools affect tasks
      if (params.taskId) {
        entities.tasks = [params.taskId];
      } else if (result?.data?.id) {
        entities.tasks = [result.data.id];
      } else if (result?.tasks) {
        entities.tasks = result.tasks.map((t: any) => t.id);
      }
    } else if (toolName.startsWith('email_')) {
      // Email tools affect emails
      if (params.emailId) {
        entities.emails = [params.emailId];
      } else if (result?.data?.id) {
        entities.emails = [result.data.id];
      } else if (result?.emails) {
        entities.emails = result.emails.map((e: any) => e.id);
      }
    } else if (toolName.startsWith('calendar_')) {
      // Calendar tools affect meetings
      if (params.meetingId) {
        entities.meetings = [params.meetingId];
      } else if (result?.data?.id) {
        entities.meetings = [result.data.id];
      }
    }
    
    return entities;
  }
  
  /**
   * Track operation for reference resolution
   */
  private trackOperation(operation: TrackedOperation): void {
    // Add to front of array (most recent first)
    this.operations.unshift(operation);
    
    // Limit history size
    if (this.operations.length > this.maxOperationHistory) {
      this.operations = this.operations.slice(0, this.maxOperationHistory);
    }
    
    console.log('[ExecutionEngine] Tracked operation:', {
      id: operation.id,
      tool: operation.tool,
      affectedEntities: operation.affectedEntities,
    });
  }
  
  /**
   * Get recent operations for context
   */
  getRecentOperations(limit: number = 10): TrackedOperation[] {
    return this.operations.slice(0, limit);
  }
  
  /**
   * Find operation by affected entity
   */
  findOperationByEntity(
    entityType: 'blocks' | 'tasks' | 'emails' | 'meetings',
    entityId: string
  ): TrackedOperation | null {
    return this.operations.find(op => 
      op.affectedEntities[entityType]?.includes(entityId)
    ) || null;
  }
  
  /**
   * Get the most recent entity of a type (for "it" resolution)
   */
  getMostRecentEntity(
    entityType: 'blocks' | 'tasks' | 'emails' | 'meetings'
  ): { id: string; operation: TrackedOperation } | null {
    for (const operation of this.operations) {
      const entities = operation.affectedEntities[entityType];
      if (entities && entities.length > 0) {
        const entityId = entities[0];
        if (entityId) {
          return {
            id: entityId,
            operation,
          };
        }
      }
    }
    return null;
  }
  
  /**
   * Clear operation history (useful for testing)
   */
  clearHistory(): void {
    this.operations = [];
  }
}

// Singleton instance
let instance: ExecutionEngine | null = null;

export function getExecutionEngine(): ExecutionEngine {
  if (!instance) {
    instance = new ExecutionEngine();
  }
  return instance;
} 