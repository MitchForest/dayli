# Sprint 4.4: RAG & Learning

**Sprint Goal**: Add continuous learning through embeddings and pattern extraction  
**Duration**: 4 days  
**Status**: PLANNING

## Objectives

1. Build embedding pipeline for decisions
2. Create RAGContextProvider service with three-layer system
3. Implement pattern extraction
4. Add feedback loops with rejection learning

## Day 1: Embedding Pipeline

### Database Setup
```sql
-- Already have embeddings table with pgvector
-- Add indexes for performance
CREATE INDEX idx_embeddings_user_type ON embeddings(user_id, type);
CREATE INDEX idx_embeddings_similarity ON embeddings USING ivfflat (embedding vector_cosine_ops);
```

### Embedding Service
```typescript
// Key methods:
- embedDecision(decision: WorkflowDecision)
- embedPattern(pattern: UserPattern)  
- embedOutcome(outcome: WorkflowOutcome)
- embedRejection(rejection: RejectionContext)
- searchSimilar(query: string, limit: number)
```

## Day 2: Three-Layer RAG Context Provider

### Implementation
```typescript
class RAGContextProvider {
  // Three-layer context system
  async getRelevantContext(query: string, userId: string): Promise<RAGContext> {
    const [patterns, recent, similar] = await Promise.all([
      this.getPatternLayer(userId),
      this.getRecentLayer(userId, 7),
      this.getSimilarLayer(query, userId)
    ]);
    
    return {
      patterns,
      recent,
      similar,
      rejections: await this.getRejections(query, userId)
    };
  }
  
  // Weighting factors:
  - Temporal decay (recent > old)
  - Success weighting (worked > failed)
  - Rejection weighting (rejected = high negative weight)
  - Relevance scoring (similar > different)
}
```

## Day 3: Pattern Extraction

### Pattern Types
1. **Schedule Patterns**: "Always moves lunch to 11:30"
2. **Task Patterns**: "Completes complex tasks in morning"
3. **Email Patterns**: "Responds to CEO immediately"
4. **Meeting Patterns**: "Prefers 30-min meetings"
5. **Rejection Patterns**: "Never schedules before 8am"

### Extraction Pipeline
```typescript
// Nightly job to extract patterns
async function extractPatterns(userId: string) {
  // 1. Cluster similar decisions
  const decisions = await getRecentDecisions(userId, 30);
  const clusters = await clusterDecisions(decisions);
  
  // 2. Find high-success clusters
  const successfulPatterns = clusters.filter(c => c.successRate > 0.8);
  
  // 3. Find rejection clusters
  const rejectionPatterns = clusters.filter(c => c.rejectionRate > 0.5);
  
  // 4. Generate pattern descriptions
  for (const pattern of [...successfulPatterns, ...rejectionPatterns]) {
    const description = await generatePatternDescription(pattern);
    await storePattern(userId, description, pattern.confidence);
  }
  
  // 5. Store as embeddings for future retrieval
}
```

## Day 4: Feedback Loops

### Capture Points
1. **Workflow Completion**: Store decisions
2. **User Confirmation**: Mark success/failure
3. **Manual Adjustments**: Learn preferences
4. **Explicit Feedback**: "This worked well"
5. **Rejections**: "No, don't do that"

### Implementation
```typescript
// After workflow execution
await captureFeedback({
  workflowId,
  decisions: proposedChanges,
  context: currentState,
  timestamp: new Date()
});

// After user action
await updateOutcome({
  decisionId,
  accepted: boolean,
  modifications: any[],
  reason?: string
});

// NEW: Rejection learning
await captureRejection({
  workflowId,
  rejectedProposal: proposedChanges,
  context: currentState,
  userFeedback?: string,
  timestamp: new Date()
});

// Use in future decisions
const context = await ragProvider.getRelevantContext(query, userId);
if (context.rejections.length > 0) {
  console.log('Avoiding previously rejected pattern:', context.rejections[0]);
}
```

## Success Criteria

- [ ] Embeddings stored for all decisions
- [ ] Three-layer RAG context working
- [ ] Rejection patterns tracked and avoided
- [ ] Patterns extracted successfully
- [ ] Measurable reduction in rejections over time

## Next Sprint
Sprint 4.5: UI Enhancement 