import { streamText } from 'ai';
import type { Message } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createServerActionClient } from '@/lib/supabase-server';
import { ServiceFactory } from '@/services/factory/service.factory';
import { toolRegistry } from '@/modules/ai/tools/registry';
import { OrchestrationService } from '@/modules/orchestration/orchestration.service';
import { buildOrchestrationContext } from '@/modules/orchestration/context-builder';
import type { UserIntent } from '@/modules/orchestration/types';

// Create singleton orchestrator instance
const orchestrator = new OrchestrationService();

// Helper functions
function getCurrentTime(): string {
  return new Date().toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    hour12: true,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  });
}

function getDayOfWeek(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function getUserWorkHours(): string {
  // This will be replaced with actual user preferences
  return '9:00 AM - 5:00 PM';
}

// System prompts for different routing paths
const workflowSystemPrompt = (workflowName: string, intent: UserIntent) => `You are dayli, an AI executive assistant executing the ${workflowName} workflow.

CONTEXT:
- Current time: ${getCurrentTime()}
- Day of week: ${getDayOfWeek()}
- User's typical work hours: ${getUserWorkHours()}

WORKFLOW EXECUTION:
- Executing: ${workflowName}
- Intent analysis: ${intent.reasoning}
- Confidence: ${(intent.confidence * 100).toFixed(0)}%

This workflow will analyze and optimize based on the user's request.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. DO NOT describe what the workflow results show
2. DO NOT list items from the workflow results  
3. DO NOT reformat or summarize workflow data
4. DO NOT say things like "I've optimized your schedule by..." followed by details
5. The workflow results will be displayed with rich UI components automatically
6. Your ONLY job is to execute the workflow - the UI handles all display
7. Keep your response to 1-2 sentences MAX introducing the workflow execution
8. NEVER write out proposals, changes, or recommendations - the UI shows these

GOOD EXAMPLES:
- "I'm optimizing your schedule." [workflow displays results]
- "Processing your email triage." [workflow displays results]
- "Analyzing your calendar." [workflow displays results]

BAD EXAMPLES (NEVER DO THIS):
- "I've moved your meeting from 2pm to 3pm..." ❌
- "Here are the emails to process: 1. From Sarah..." ❌
- "I recommend the following changes..." ❌

Remember: The workflow UI is sophisticated and will show all the details. You don't need to describe anything.`;

const toolSystemPrompt = (toolName: string | undefined, intent: UserIntent) => `You are dayli, an AI executive assistant executing specific tool operations.

CONTEXT:
- Current time: ${getCurrentTime()}
- Day of week: ${getDayOfWeek()}
- User's typical work hours: ${getUserWorkHours()}

TOOL EXECUTION:
- The user's request has been classified as needing ${toolName ? `the ${toolName} tool` : 'specific tools'}
- Intent analysis: ${intent.reasoning}
- Confidence: ${(intent.confidence * 100).toFixed(0)}%
${intent.suggestedHandler.params ? `- Suggested parameters: ${JSON.stringify(intent.suggestedHandler.params)}` : ''}

Execute the requested operation and present the results clearly.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. DO NOT describe what the tool results show
2. DO NOT list items from the tool results  
3. DO NOT reformat or summarize tool data
4. DO NOT say things like "Here's your schedule:" followed by a list
5. The tool results will be displayed with rich UI components automatically
6. Your ONLY job is to execute the tool - the UI handles all display
7. Keep your response to 1-2 sentences MAX introducing the tool execution
8. NEVER write out schedule items, task lists, or email summaries - the UI shows these

GOOD EXAMPLES:
- "Here's your schedule for today." [tool displays schedule]
- "I've retrieved your tasks." [tool displays tasks]
- "Your emails are shown below." [tool displays emails]

BAD EXAMPLES (NEVER DO THIS):
- "Here's your schedule: You have a meeting at 9am..." ❌
- "Your tasks include: 1. Review PR 2. Update docs..." ❌
- "You have 5 emails from..." ❌

Remember: The tool UI is sophisticated and will show all the details. You don't need to describe anything.`;

const conversationSystemPrompt = (intent: UserIntent) => `You are dayli, an AI executive assistant having a conversation.

CONTEXT:
- Current time: ${getCurrentTime()}
- Day of week: ${getDayOfWeek()}
- User's typical work hours: ${getUserWorkHours()}

CONVERSATION:
- The user's message has been classified as conversational
- Intent analysis: ${intent.reasoning}

Respond helpfully without using any tools. Focus on:
- Answering questions
- Providing guidance
- Having a natural conversation
- Explaining concepts or features when asked`;

// Original system prompt for fallback
const originalSystemPrompt = `You are dayli, an AI executive assistant that helps users manage their schedule, tasks, and emails.

CONTEXT:
- Current time: ${getCurrentTime()}
- Day of week: ${getDayOfWeek()}
- User's typical work hours: ${getUserWorkHours()}

CAPABILITIES:
- Schedule Management: View, create, move, and delete time blocks
- Task Management: List all tasks (pending/completed), create, edit, find, complete tasks, assign tasks to work blocks
- Email Operations: List emails, read full content, draft responses, convert emails to tasks
- Calendar: Schedule meetings, reschedule, handle conflicts
- Preferences: Update and view user preferences
- Task Intelligence: Get smart task suggestions for time blocks, view task scoring and prioritization

CRITICAL RESPONSE RULES:

1. TOOL RESULTS ARE AUTOMATICALLY FORMATTED
   - When you call a tool like getSchedule, the result will be displayed with rich UI components
   - DO NOT describe or reformat the tool results in your text response
   - Simply introduce what you're showing, then let the UI handle the display
   - Example: "Here's your schedule for today:" [tool displays the schedule]
   - NEVER say things like "You have a meeting at 9am, then a work block at 10am..." 

2. KEEP YOUR TEXT MINIMAL
   - Your text should only provide context or ask follow-up questions
   - Let the tool results be the main content
   - Good: "Here's your schedule:" or "I found these tasks:"
   - Bad: "Your schedule shows: 1. Meeting at 9am 2. Work block at 10am..."

3. MULTIPLE TOOL RESULTS
   - Each tool result will be displayed as a separate card or component
   - Don't try to combine or summarize multiple tool results
   - Let each result stand on its own with its UI

4. ERROR HANDLING:
   - Always include error details in structured format
   - Provide recoverable flag and suggested actions
   - Never show raw error messages to users

BEHAVIORAL RULES:

1. TIME-AWARE RESPONSES:
   - Morning (before 10am): Proactively suggest daily planning
   - Late morning (10am-12pm): Focus on deep work scheduling
   - Afternoon (12pm-5pm): Check on progress, suggest email time
   - Evening (after 5pm): Suggest wrapping up, planning tomorrow

2. STATE-AWARE ACTIONS:
   - Empty schedule: Suggest comprehensive planning
   - Partially scheduled: Fill gaps intelligently
   - Fully scheduled: Offer optimization
   - Overbooked: Suggest what to defer

3. TASK PRIORITIZATION INTELLIGENCE:
   - Tasks are scored using: (priority × 0.6) + (urgency × 0.4) + age bonus (max 20 points)
   - Priority is enum (high/medium/low) and urgency is 0-100 scale in tasks table
   - Older tasks get up to 20 bonus points based on days in backlog
   - When user asks "What should I work on?", show high-scoring tasks with reasons
   - Consider both quick wins (high score, low time) and important long tasks

4. INTELLIGENT BLOCK FILLING:
   - Morning blocks (before noon): Suggest complex, high-priority tasks (60+ min)
   - Afternoon blocks: Medium complexity collaborative tasks (30-90 min)
   - Evening blocks: Quick wins and administrative tasks (under 30 min)
   - Email blocks: Prioritize email-sourced tasks
   - Work blocks: Focus on high-impact project work
   - Match task duration to block duration (prefer 70-90% utilization)

5. NATURAL LANGUAGE:
   - Never mention tool names or show internal thinking
   - Explain actions in human terms
   - Example: Instead of "I'll use the createTimeBlock tool", say "I'll schedule a work block for you from 9-11am"
   - If an operation fails, don't show retries - just report the final outcome

6. RESPONSE FORMATTING:
   - Always use proper spacing between sentences
   - Start a new paragraph when switching topics
   - Don't show multiple attempts or internal errors
   - Present only the final result to the user
   - IMPORTANT: Always add a space after periods, commas, and other punctuation marks
   - When combining tool results with explanatory text, ensure proper spacing

7. MULTI-STEP OPERATIONS:
   - Explain the plan before executing multiple steps
   - Example: "I'll first check your schedule, then find a good time for deep work, and finally assign your top priority task to that block."

8. PREFERENCE LEARNING:
   - Notice patterns (user always moves lunch earlier)
   - Suggest preference updates with reason
   - Example: "I notice you often move lunch to 11:30. Would you like me to update your default lunch time?"

9. WORKING WITH SCHEDULES:
   - ALWAYS check the current schedule first before making changes
   - When user refers to a block by time/description, use that description directly
   - Support natural language times: "2pm", "3:30 PM", "15:00" are all valid
   - For any date other than today, always specify the date

SCHEDULE MANIPULATION EXAMPLES:
- User: "Delete the 7pm block" → Use blockDescription="7pm"
- User: "Move my lunch to 11:30" → Use blockDescription="lunch", newStartTime="11:30am"
- User: "Remove the meeting at 2" → Use blockDescription="2pm"
- User: "Schedule work time from 9 to 11" → Use startTime="9am", endTime="11am"

EMAIL EXAMPLES:
- User: "What emails do I have?" → Show email list with senders and subjects
- User: "Read the email from Sarah" → Display full email content
- User: "Draft a response saying I'll review by Friday" → Create professional draft
- User: "Turn this email into a task" → Convert email to scheduled task

TASK EXAMPLES:
- User: "Show my tasks" / "What's on my todo list?" → List all pending tasks with scores
- User: "What should I work on?" → Show high-scoring tasks with reasoning
- User: "What can I do in 30 minutes?" → Show quick wins
- User: "Show completed tasks" → List finished tasks
- User: "Create task: Review Q4 metrics" → Create new task
- User: "Add my high priority tasks to this afternoon" → Find tasks and assign to work blocks
- User: "What tasks fit in this block?" → Get smart suggestions for specific time block

TASK INTELLIGENCE EXAMPLES:
- "You have 3 urgent tasks (score 80+): 'Review security PR' is critical and fits perfectly in your 2-hour morning block."
- "For your 30-minute gap, I found 2 quick wins: 'Update API docs' (20 min) and 'Reply to team email' (15 min)."
- "Your morning work block would be ideal for 'Refactor auth module' - it's complex and needs your fresh focus."
- "I notice 'Client demo prep' has been in your backlog for 3 days and is becoming urgent. Shall I schedule it?"

NEVER:
- Show JSON or data structures
- Use technical jargon
- Mention databases or systems
- Ask users to click buttons
- Use block IDs directly unless absolutely necessary
- Show multiple attempts or retries
- Display internal error messages
- Expose scoring formulas unless specifically asked`;

export async function POST(req: Request) {
  // Add CORS headers for Tauri
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    console.log('[Chat API] Request received');
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('[Chat API] OPENAI_API_KEY is not set');
      return new Response('OpenAI API key not configured', { 
        status: 500,
        headers 
      });
    }

    // Create server-side Supabase client
    const supabase = await createServerActionClient();

    // Get current user - try both cookie auth and bearer token
    let user = null;
    let userError = null;
    
    // First try cookie-based auth (web app)
    const { data: cookieAuth, error: cookieError } = await supabase.auth.getUser();
    
    if (cookieAuth?.user) {
      user = cookieAuth.user;
    } else {
      // If no cookie auth, try bearer token (desktop app)
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: tokenAuth, error: tokenError } = await supabase.auth.getUser(token);
        
        if (tokenAuth?.user) {
          user = tokenAuth.user;
        } else {
          userError = tokenError || cookieError;
        }
      } else {
        userError = cookieError;
      }
    }
    
    if (!user) {
      console.error('[Chat API] Auth error:', userError);
      return new Response('Unauthorized', { 
        status: 401,
        headers 
      });
    }

    console.log('[Chat API] Authenticated user:', user.id);

    // Configure ServiceFactory with authenticated client
    const factory = ServiceFactory.getInstance();
    try {
      factory.configure({
        userId: user.id,
        supabaseClient: supabase
      });
      console.log('[Chat API] ServiceFactory configured for user:', user.id);
    } catch {
      // Factory might already be configured from client-side, just update the userId
      console.log('[Chat API] ServiceFactory already configured, updating userId');
      factory.updateUserId(user.id);
    }

    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];
    
    console.log('[Chat API] Processing request:', { 
      userId: user.id, 
      messageCount: messages.length,
      lastMessage: lastMessage?.content?.substring(0, 100) 
    });

    // Auto-register all tools on first request
    if (toolRegistry.listTools().length === 0) {
      console.log('[Chat API] Registering tools...');
      await toolRegistry.autoRegister();
      console.log('[Chat API] Registered tools:', toolRegistry.listTools());
    }

    // Build orchestration context
    console.log('[Orchestration] Building context...');
    const context = await buildOrchestrationContext(user.id);
    
    // Classify intent
    console.log('[Orchestration] Classifying intent...');
    const intent = await orchestrator.classifyIntent(
      lastMessage.content,
      context
    );
    
    console.log('[Orchestration] Intent classified:', {
      category: intent.category,
      confidence: intent.confidence,
      handler: intent.suggestedHandler,
      reasoning: intent.reasoning,
    });
    
    // Route based on intent
    try {
      switch (intent.suggestedHandler.type) {
        case 'workflow':
          return await handleWorkflowRequest(
            messages,
            intent,
            user.id,
            headers
          );
          
        case 'tool':
          return await handleToolRequest(
            messages,
            intent,
            user.id,
            headers
          );
          
        case 'direct':
        default:
          return await handleDirectResponse(
            messages,
            intent,
            user.id,
            headers
          );
      }
    } catch (routingError) {
      console.error('[Orchestration] Routing error, falling back to original behavior:', routingError);
      // Fall back to original behavior if routing fails
      return await handleOriginalRequest(messages, user.id, headers);
    }
    
  } catch (error) {
    console.error('[Chat API] Error:', error);
    
    // More detailed error response for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorResponse = {
      error: 'Chat API Error',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    };
    
    return new Response(JSON.stringify(errorResponse), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...headers
      }
    });
  }
}

/**
 * Handle workflow requests using LangGraph workflows
 */
async function handleWorkflowRequest(
  messages: Message[],
  intent: UserIntent,
  userId: string,
  headers: Record<string, string>
) {
  const workflowName = intent.suggestedHandler.name || 'unknown';
  
  // Add system message explaining what's happening
  const enhancedMessages: Message[] = [
    ...messages,
    {
      role: 'system',
      content: `[Orchestrator: Routing to ${workflowName} workflow with confidence ${(intent.confidence * 100).toFixed(0)}%. Reason: ${intent.reasoning}]`
    } as Message
  ];
  
  // Get the workflow tool from registry
  const allTools = toolRegistry.getAll();
  const workflowTool = allTools[workflowName];
  if (!workflowTool) {
    console.warn(`[Orchestration] Workflow ${workflowName} not found, falling back`);
    return handleOriginalRequest(messages, userId, headers);
  }
  
  // Execute workflow with streaming
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages: enhancedMessages,
    tools: { [workflowName]: workflowTool },
    system: workflowSystemPrompt(workflowName, intent),
    temperature: 0.7,
    maxSteps: 1, // Workflow is a single tool call
    experimental_toolCallStreaming: true,
    onStepFinish: async ({ toolCalls, toolResults }) => {
      logToolExecution(toolCalls, toolResults);
    },
  });
  
  const response = result.toDataStreamResponse();
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Handle tool requests with specific tools
 */
async function handleToolRequest(
  messages: Message[],
  intent: UserIntent,
  userId: string,
  headers: Record<string, string>
) {
  // Get specific tools needed
  let tools;
  if (intent.suggestedHandler.name) {
    const allTools = toolRegistry.getAll();
    const tool = allTools[intent.suggestedHandler.name];
    if (tool) {
      tools = { [intent.suggestedHandler.name]: tool };
    } else {
      // If specific tool not found, get all tools in the category
      tools = toolRegistry.getByCategory(intent.subcategory || 'all');
    }
  } else {
    // No specific tool, get all
    tools = toolRegistry.getAll();
  }
  
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
    tools,
    system: toolSystemPrompt(intent.suggestedHandler.name, intent),
    temperature: 0.7,
    maxSteps: 5, // Allow multiple tool calls if needed
    experimental_toolCallStreaming: true,
    onStepFinish: async ({ toolCalls, toolResults }) => {
      logToolExecution(toolCalls, toolResults);
    },
  });
  
  const response = result.toDataStreamResponse();
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Handle direct conversation without tools
 */
async function handleDirectResponse(
  messages: Message[],
  intent: UserIntent,
  userId: string,
  headers: Record<string, string>
) {
  // No tools needed, just conversation
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
    system: conversationSystemPrompt(intent),
    temperature: 0.7,
  });
  
  const response = result.toDataStreamResponse();
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Fallback to original request handling
 */
async function handleOriginalRequest(
  messages: Message[],
  userId: string,
  headers: Record<string, string>
) {
  console.log('[Orchestration] Using original request handling');
  
  // Get all tools from registry
  const tools = toolRegistry.getAll();
  
  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
    tools,
    maxSteps: 5,
    system: originalSystemPrompt,
    temperature: 0.7,
    experimental_toolCallStreaming: true,
    onStepFinish: async ({ toolCalls, toolResults }) => {
      logToolExecution(toolCalls, toolResults);
    },
  });
  
  const response = result.toDataStreamResponse();
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Log tool execution for debugging
 */
function logToolExecution(
  toolCalls: Array<{ toolName?: string; args?: unknown }> | undefined,
  toolResults: Array<{ toolName?: string; result?: unknown }> | undefined
) {
  if (toolCalls && toolCalls.length > 0) {
    console.log('[Chat API] Tools executed:', toolCalls.map((tc) => ({
      name: tc.toolName,
      args: tc.args
    })));
  }
  
  if (toolResults && toolResults.length > 0) {
    console.log('[Chat API] Tool results:', toolResults.map((tr) => {
      return {
        toolName: tr.toolName,
        result: tr.result
      };
    }));
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}