import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@repo/database/types';
import { ServiceFactory } from '@/services/factory/service.factory';

// Import all tools
import {
  createTimeBlock,
  moveTimeBlock,
  deleteTimeBlock,
  assignTaskToBlock,
  completeTask,
  getSchedule,
  getUnassignedTasks,
  updatePreference,
  getPreferences,
} from '@/modules/ai/tools';

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

EXAMPLES OF GOOD RESPONSES:
- "I'll schedule a 2-hour focus block this morning for your strategy deck, followed by 30 minutes for emails."
- "Your afternoon is free. Shall I add time for the project review?"
- "You have 3 unscheduled tasks. Let me find the best times for them based on your energy patterns."

NEVER:
- Show JSON or data structures
- Use technical jargon
- Mention databases or systems
- Ask users to click buttons`;

export async function POST(req: Request) {
  try {
    console.log('Chat API called');
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set');
      return new Response('OpenAI API key not configured', { status: 500 });
    }

    // Create server-side Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response('Unauthorized', { status: 401 });
    }

    // Configure ServiceFactory with Supabase client BEFORE setting up the global user ID
    const factory = ServiceFactory.getInstance();
    factory.configure({ userId: user.id, supabaseClient: supabase }, false); // Use real services
    
    // Set up global user ID for tools
    (global as Record<string, unknown>).getCurrentUserId = () => user.id;

    const { messages } = await req.json();
    
    console.log('Chat request received:', { 
      userId: user.id, 
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1]?.content?.substring(0, 100) 
    });

    // Define all tools
    const tools = {
      createTimeBlock,
      moveTimeBlock,
      deleteTimeBlock,
      assignTaskToBlock,
      completeTask,
      getSchedule,
      getUnassignedTasks,
      updatePreference,
      getPreferences,
    };

    try {
      const result = await streamText({
        model: openai('gpt-4-turbo'),
        messages,
        tools,
        maxSteps: 5, // Allow multi-step operations
        system: systemPrompt,
        temperature: 0.7,
        onStepFinish: async ({ toolCalls }) => {
          // This callback fires after each tool execution
          // Could be used to update UI with progress
          console.log('Tool executed:', toolCalls?.map(tc => tc.toolName));
        },
      });

      return result.toDataStreamResponse();
    } finally {
      // Restore original function
      (global as Record<string, unknown>).getCurrentUserId = undefined;
    }
  } catch (error) {
    console.error('Chat API error:', error);
    
    // More detailed error response for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorResponse = {
      error: 'Chat API Error',
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    };
    
    return new Response(JSON.stringify(errorResponse), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Type declaration for global context
declare global {
  var getCurrentUserId: () => string;
} 