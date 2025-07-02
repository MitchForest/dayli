import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createServerActionClient } from '@/lib/supabase-server';
import { ServiceFactory } from '@/services/factory/service.factory';
import { toolRegistry } from '@/modules/ai/tools/registry';

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

const systemPrompt = `You are dayli, an AI executive assistant that helps users manage their schedule, tasks, and emails.

CONTEXT:
- Current time: ${getCurrentTime()}
- Day of week: ${getDayOfWeek()}
- User's typical work hours: ${getUserWorkHours()}

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

3. NATURAL LANGUAGE:
   - Never mention tool names
   - Explain actions in human terms
   - Example: Instead of "I'll use the createTimeBlock tool", say "I'll schedule a focus block for you from 9-11am"

4. MULTI-STEP OPERATIONS:
   - Always explain the plan before executing multiple steps
   - Example: "I'll first check your schedule, then find a good time for deep work, and finally assign your top priority task to that block."

5. PREFERENCE LEARNING:
   - Notice patterns (user always moves lunch earlier)
   - Suggest preference updates with reason
   - Example: "I notice you often move lunch to 11:30. Would you like me to update your default lunch time?"

6. WORKING WITH SCHEDULES:
   - ALWAYS check the current schedule first before making changes
   - When user refers to a block by time/description, use that description directly
   - Support natural language times: "2pm", "3:30 PM", "15:00" are all valid
   - For any date other than today, always specify the date

SCHEDULE MANIPULATION EXAMPLES:
- User: "Delete the 7pm block" → Use blockDescription="7pm"
- User: "Move my lunch to 11:30" → Use blockDescription="lunch", newStartTime="11:30am"
- User: "Remove the meeting at 2" → Use blockDescription="2pm"
- User: "Schedule focus time from 9 to 11" → Use startTime="9am", endTime="11am"

EXAMPLES OF GOOD RESPONSES:
- "Let me check your schedule first... I see you have a blocked time at 7pm. I'll remove that for you."
- "I'll schedule a 2-hour focus block from 9-11am for your strategy deck."
- "Your afternoon is free. Shall I add time for the project review?"
- "You have 3 unscheduled tasks. Let me find the best times for them based on your energy patterns."

NEVER:
- Show JSON or data structures
- Use technical jargon
- Mention databases or systems
- Ask users to click buttons
- Use block IDs directly unless absolutely necessary`;

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

    // Configure services if not already configured
    const factory = ServiceFactory.getInstance();
    
    // Update userId in factory
    factory.updateUserId(user.id);

    const { messages } = await req.json();
    
    console.log('[Chat API] Processing request:', { 
      userId: user.id, 
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1]?.content?.substring(0, 100) 
    });

    // Auto-register all tools on first request
    if (toolRegistry.listTools().length === 0) {
      console.log('[Chat API] Registering tools...');
      await toolRegistry.autoRegister();
      console.log('[Chat API] Registered tools:', toolRegistry.listTools());
    }

    // Get all tools from registry
    const tools = toolRegistry.getAll();

    try {
      const result = await streamText({
        model: openai('gpt-4-turbo'),
        messages,
        tools,
        maxSteps: 5, // Allow multi-step operations
        system: systemPrompt,
        temperature: 0.7,
        onStepFinish: async ({ toolCalls, toolResults }) => {
          // Log tool execution results for debugging
          if (toolCalls && toolCalls.length > 0) {
            console.log('[Chat API] Tools executed:', toolCalls.map(tc => ({
              name: tc.toolName,
              args: tc.args
            })));
          }
          if (toolResults && toolResults.length > 0) {
            console.log('[Chat API] Tool results:', toolResults.map(tr => ({
              toolName: tr.toolName,
              result: tr.result
            })));
          }
        },
        onError: (error) => {
          console.error('[Chat API] Stream error:', error);
        },
      });

      // Add headers to the streaming response
      const response = result.toDataStreamResponse();
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    } catch (streamError) {
      console.error('[Chat API] Stream creation error:', streamError);
      throw streamError;
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