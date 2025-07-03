# Sprint 4.4: RAG & Learning

**Sprint Goal**: Add continuous learning through embeddings and pattern extraction  
**Duration**: 4 days  
**Status**: PLANNING

## Objectives

1. Build embedding pipeline for tool execution results (pure data)
2. Create RAGContextProvider service with three-layer system
3. Implement pattern extraction from tool responses
4. Add feedback loops with rejection learning
5. Integrate with new tool factory pattern

## Day 1: Embedding Pipeline

### Database Setup
```sql
-- Already have embeddings table with pgvector
-- Add indexes for performance
CREATE INDEX idx_embeddings_user_type ON embeddings(user_id, type);
CREATE INDEX idx_embeddings_similarity ON embeddings USING ivfflat (embedding vector_cosine_ops);

-- Add column for tool metadata
ALTER TABLE embeddings ADD COLUMN tool_name TEXT;
ALTER TABLE embeddings ADD COLUMN tool_category TEXT;
```

### Embedding Service
```typescript
// Key methods updated for pure data architecture:
export class EmbeddingService {
  // Embed tool execution results (pure data)
  async embedToolResult(toolResult: {
    toolName: string;
    category: string;
    params: any;
    result: BaseToolResponse;
    userId: string;
  }): Promise<void> {
    // Extract meaningful text from pure data result
    const text = this.extractTextFromResult(toolResult.result);
    const embedding = await this.generateEmbedding(text);
    
    await this.store({
      userId: toolResult.userId,
      type: 'tool_result',
      toolName: toolResult.toolName,
      toolCategory: toolResult.category,
      content: toolResult,
      embedding,
    });
  }
  
  // Embed patterns extracted from tool usage
  async embedPattern(pattern: UserPattern): Promise<void>
  
  // Embed workflow outcomes (based on tool results)
  async embedOutcome(outcome: WorkflowOutcome): Promise<void>
  
  // Embed rejections of tool proposals
  async embedRejection(rejection: {
    toolName: string;
    proposedParams: any;
    rejectedResult: BaseToolResponse;
    reason?: string;
  }): Promise<void>
  
  // Search for similar tool executions
  async searchSimilar(query: string, toolCategory?: string, limit = 10): Promise<any[]>
}
```

## Day 2: Three-Layer RAG Context Provider

### Implementation with Tool Integration
```typescript
class RAGContextProvider {
  constructor(
    private embeddingService: EmbeddingService,
    private toolRegistry: ToolRegistry
  ) {}
  
  // Three-layer context system updated for pure data
  async getRelevantContext(query: string, userId: string, toolName?: string): Promise<RAGContext> {
    // Get tool metadata if specific tool is mentioned
    const toolMetadata = toolName ? this.toolRegistry.get(toolName)?.__metadata : null;
    
    const [patterns, recent, similar] = await Promise.all([
      this.getPatternLayer(userId, toolMetadata?.category),
      this.getRecentLayer(userId, 7, toolMetadata?.category),
      this.getSimilarLayer(query, userId, toolMetadata?.category)
    ]);
    
    return {
      patterns: this.filterByToolCategory(patterns, toolMetadata?.category),
      recent: this.processRecentToolResults(recent),
      similar: this.rankBySimilarity(similar),
      rejections: await this.getRejections(query, userId, toolName),
      toolContext: toolMetadata
    };
  }
  
  // Process pure data results for context
  private processRecentToolResults(results: any[]): ProcessedContext[] {
    return results.map(r => ({
      toolName: r.toolName,
      category: r.toolCategory,
      executedAt: r.timestamp,
      success: r.result.success,
      // Extract key data points from pure result
      keyData: this.extractKeyData(r.result),
      relevance: this.calculateRelevance(r)
    }));
  }
  
  // Weighting factors updated:
  - Temporal decay (recent > old)
  - Success weighting (successful tool executions > failed)
  - Tool category relevance (same category > different)
  - Rejection weighting (rejected tool proposals = high negative weight)
  - Data similarity scoring (similar params/results > different)
}
```

## Day 3: Pattern Extraction

### Pattern Types from Tool Usage
1. **Schedule Tool Patterns**: "Always creates 90-min work blocks in morning"
2. **Task Tool Patterns**: "Assigns high-priority tasks to first work block"
3. **Email Tool Patterns**: "Converts CEO emails to tasks immediately"
4. **Calendar Tool Patterns**: "Schedules meetings with 15-min prep blocks"
5. **Workflow Patterns**: "Runs schedule optimization every Monday"

### Extraction Pipeline with Tool Factory Integration
```typescript
// Nightly job to extract patterns from tool usage
async function extractPatterns(userId: string) {
  // 1. Get all tool executions from last 30 days
  const toolExecutions = await getRecentToolExecutions(userId, 30);
  
  // 2. Group by tool category (using tool registry metadata)
  const byCategory = toolExecutions.reduce((acc, exec) => {
    const category = exec.toolCategory || 'unknown';
    acc[category] = acc[category] || [];
    acc[category].push(exec);
    return acc;
  }, {});
  
  // 3. Analyze each category for patterns
  for (const [category, executions] of Object.entries(byCategory)) {
    // Cluster similar tool parameters and results
    const clusters = await clusterToolExecutions(executions);
    
    // Find high-success patterns
    const successfulPatterns = clusters.filter(c => 
      c.executions.filter(e => e.result.success).length / c.executions.length > 0.8
    );
    
    // Find rejection patterns
    const rejectionPatterns = await findRejectionPatterns(userId, category);
    
    // Generate pattern descriptions from pure data
    for (const pattern of [...successfulPatterns, ...rejectionPatterns]) {
      const description = await generatePatternFromData(pattern);
      await embeddingService.embedPattern({
        userId,
        category,
        description,
        confidence: pattern.confidence,
        exampleExecutions: pattern.executions.slice(0, 3)
      });
    }
  }
}

// Helper to generate patterns from pure data
async function generatePatternFromData(pattern: ToolExecutionCluster): string {
  // Analyze common parameters
  const commonParams = findCommonParams(pattern.executions);
  
  // Analyze common results
  const commonResults = findCommonResults(pattern.executions);
  
  // Generate human-readable pattern
  return `User typically ${pattern.toolName} with ${describeParams(commonParams)} 
          resulting in ${describeResults(commonResults)}`;
}
```

## Day 4: Feedback Loops

### Capture Points with Tool Results
1. **Tool Execution**: Store params and pure data results
2. **User Confirmation**: Mark tool result as accepted/rejected
3. **Manual Adjustments**: Learn from modifications to tool proposals
4. **Explicit Feedback**: Link to specific tool executions
5. **Rejections**: Track rejected tool proposals with reasons

### Implementation with Tool Factory
```typescript
// Hook into tool factory execution
const toolFactoryWithLearning = {
  async executeWithLearning(tool: any, params: any, userId: string) {
    const startTime = Date.now();
    
    // Execute tool
    const result = await tool.execute(params);
    
    // Capture execution for learning
    await embeddingService.embedToolResult({
      toolName: tool.__name,
      category: tool.__metadata?.category,
      params,
      result,
      userId,
      executionTime: Date.now() - startTime
    });
    
    return result;
  }
};

// After user action on tool result
await updateToolOutcome({
  executionId,
  accepted: boolean,
  modifications: any[],
  reason?: string
});

// Rejection learning for tool proposals
await captureToolRejection({
  toolName: string,
  proposedParams: any,
  proposedResult: BaseToolResponse,
  userFeedback?: string,
  alternativeAction?: string
});

// Use in future tool executions
const context = await ragProvider.getRelevantContext(
  userQuery, 
  userId,
  suggestedTool.__name
);

if (context.rejections.length > 0) {
  console.log('Previously rejected similar execution:', context.rejections[0]);
  // Adjust tool parameters or suggest alternative
}
```

## Integration with Tool Registry

```typescript
// Extend tool registry for learning
class LearningToolRegistry extends ToolRegistry {
  async getToolWithContext(toolName: string, userId: string, query: string) {
    const tool = this.get(toolName);
    if (!tool) return null;
    
    // Get relevant context for this tool
    const context = await ragProvider.getRelevantContext(query, userId, toolName);
    
    // Return tool with context for smarter parameter generation
    return {
      tool,
      context,
      suggestedParams: this.generateParamsFromContext(tool, context)
    };
  }
}
```

## Success Criteria

- [ ] Tool execution results (pure data) embedded successfully
- [ ] Three-layer RAG context works with tool categories
- [ ] Rejection patterns for tools tracked and avoided
- [ ] Patterns extracted from tool usage data
- [ ] Integration with tool factory pattern complete
- [ ] Measurable improvement in tool parameter suggestions
- [ ] Reduction in tool proposal rejections over time

## Next Sprint
Sprint 4.5: UI Enhancement 