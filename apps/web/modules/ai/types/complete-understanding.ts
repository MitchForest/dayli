import { z } from 'zod';

/**
 * Schema for AI's complete understanding of user intent
 * This represents the AI's interpretation and resolution of natural language
 */

// Intent understanding
const intentSchema = z.object({
  primary: z.string().describe('Primary user intent (e.g., "schedule_meeting", "view_schedule")'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  reasoning: z.string().describe('Explanation of why AI chose this interpretation'),
});

// Execution plan
const executionSchema = z.object({
  type: z.enum(['single', 'workflow', 'multi_step']).describe('Type of execution needed'),
  
  // For single tool operations
  tool: z.string().optional().describe('Tool name for single operations'),
  parameters: z.record(z.any()).optional().describe('Fully resolved parameters - no natural language'),
  
  // For workflows
  workflow: z.string().optional().describe('Workflow name for complex operations'),
  
  // For multi-step operations
  steps: z.array(z.object({
    tool: z.string().describe('Tool to execute'),
    parameters: z.record(z.any()).describe('Resolved parameters for this step'),
    dependsOn: z.array(z.number()).optional().describe('Indices of steps this depends on'),
  })).optional().describe('Steps for multi-step operations'),
});

// Resolved entity
const resolvedEntitySchema = z.object({
  original: z.string().describe('Original natural language reference'),
  resolved: z.string().describe('Resolved concrete value (ID, date, time)'),
  confidence: z.number().min(0).max(1).describe('Confidence in resolution'),
});

// All resolved entities
const resolvedEntitiesSchema = z.object({
  // Date resolutions
  dates: z.array(resolvedEntitySchema.extend({
    original: z.string().describe('Natural language date (e.g., "tomorrow", "next Monday")'),
    resolved: z.string().describe('ISO date string (e.g., "2025-07-05")'),
  })).describe('Resolved date references'),
  
  // Time resolutions
  times: z.array(resolvedEntitySchema.extend({
    original: z.string().describe('Natural language time (e.g., "after lunch", "3pm")'),
    resolved: z.string().describe('24-hour time format (e.g., "15:00")'),
  })).describe('Resolved time references'),
  
  // Block resolutions
  blocks: z.array(resolvedEntitySchema.extend({
    original: z.string().describe('Natural language block reference (e.g., "my morning block")'),
    resolved: z.string().describe('Block ID (e.g., "block-123")'),
  })).describe('Resolved block references'),
  
  // General entity resolutions
  entities: z.array(resolvedEntitySchema.extend({
    type: z.enum(['block', 'task', 'email', 'meeting']).describe('Type of entity'),
    original: z.string().describe('Reference like "it", "that", "the meeting"'),
    resolved: z.string().describe('Entity ID'),
  })).describe('Resolved entity references'),
});

// Ambiguity that needs clarification
const ambiguitySchema = z.object({
  type: z.string().describe('Type of ambiguity (e.g., "multiple_blocks", "unclear_date")'),
  message: z.string().describe('Human-friendly clarification request'),
  options: z.array(z.object({
    value: z.any().describe('Option value'),
    display: z.string().describe('Human-readable option description'),
  })).describe('Available options for user to choose from'),
});

// Response metadata
const metadataSchema = z.object({
  processingTime: z.number().describe('Time taken to process in milliseconds'),
  contextUsed: z.array(z.string()).describe('Which parts of context were relevant'),
  confidence: z.number().min(0).max(1).describe('Overall confidence in understanding'),
});

/**
 * Complete understanding schema - the AI's full interpretation
 */
export const completeUnderstandingSchema = z.object({
  // User's intent
  intent: intentSchema,
  
  // Execution plan with fully resolved parameters
  execution: executionSchema,
  
  // All resolved natural language references
  resolved: resolvedEntitiesSchema,
  
  // Ambiguities requiring clarification (if any)
  ambiguities: z.array(ambiguitySchema).optional().describe('Ambiguities needing user clarification'),
  
  // Processing metadata
  metadata: metadataSchema,
});

/**
 * TypeScript type derived from schema
 */
export type CompleteUnderstanding = z.infer<typeof completeUnderstandingSchema>;

/**
 * Example of a complete understanding:
 * 
 * User: "Move my morning meeting to after lunch tomorrow"
 * 
 * Understanding: {
 *   intent: {
 *     primary: "reschedule_meeting",
 *     confidence: 0.95,
 *     reasoning: "User wants to move a meeting to a different time"
 *   },
 *   execution: {
 *     type: "single",
 *     tool: "schedule_moveTimeBlock",
 *     parameters: {
 *       blockId: "meeting-456",
 *       newStartTime: "13:00",
 *       date: "2025-07-05"
 *     }
 *   },
 *   resolved: {
 *     dates: [{
 *       original: "tomorrow",
 *       resolved: "2025-07-05",
 *       confidence: 1.0
 *     }],
 *     times: [{
 *       original: "after lunch",
 *       resolved: "13:00",
 *       confidence: 0.9
 *     }],
 *     blocks: [{
 *       original: "my morning meeting",
 *       resolved: "meeting-456",
 *       confidence: 0.85
 *     }],
 *     entities: []
 *   },
 *   metadata: {
 *     processingTime: 342,
 *     contextUsed: ["temporal", "state.schedule", "patterns.lunchTime"],
 *     confidence: 0.9
 *   }
 * }
 */ 