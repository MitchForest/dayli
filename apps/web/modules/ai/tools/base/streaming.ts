import { z } from 'zod';
import { createTool, BaseToolResponse, ToolMetadata } from './tool-factory';

export interface StreamUpdate<T> {
  progress: number;
  stage: string;
  partialResult?: Partial<T>;
}

export interface StreamingStage<TParams, TContext = any> {
  name: string;
  weight: number; // Progress weight (should sum to 100)
  execute: (params: TParams, context: TContext) => Promise<any>;
}

// Helper to create streaming tools
export function createStreamingTool<TParams extends z.ZodType, TResponse extends BaseToolResponse>(
  config: {
    name: string;
    description: string;
    parameters: TParams;
    metadata: ToolMetadata;
    stages: StreamingStage<z.infer<TParams>>[];
    finalizeResult: (context: any) => TResponse;
  }
) {
  const executeStream = async function* (params: z.infer<TParams>) {
    const context: any = {};
    let totalProgress = 0;
    
    for (const stage of config.stages) {
      yield {
        progress: totalProgress,
        stage: stage.name,
      };
      
      try {
        context[stage.name] = await stage.execute(params, context);
        totalProgress += stage.weight;
        
        yield {
          progress: totalProgress,
          stage: `${stage.name} complete`,
          partialResult: context,
        };
      } catch (error) {
        yield {
          progress: totalProgress,
          stage: `Error in ${stage.name}: ${error}`,
          partialResult: context,
        };
        throw error;
      }
    }
    
    // Final result
    const result = config.finalizeResult(context);
    yield {
      progress: 100,
      stage: 'Complete',
      result,
    };
  };
  
  return createTool({
    ...config,
    execute: async (params) => {
      // Fallback for non-streaming execution
      const context: any = {};
      for (const stage of config.stages) {
        context[stage.name] = await stage.execute(params, context);
      }
      return config.finalizeResult(context);
    },
  });
}