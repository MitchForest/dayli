import { createServerActionClient } from '@/lib/supabase-server';
import { ServiceFactory } from '@/services/factory/service.factory';
import { getAIOrchestrator } from '@/modules/ai/services/ai-orchestrator';

export async function POST(req: Request) {
  // Add CORS headers for Tauri
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
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

    // Authenticate user - try both cookie auth and bearer token
    let user = null;
    
    // First try cookie-based auth (web app)
    const { data: cookieAuth } = await supabase.auth.getUser();
    
    if (cookieAuth?.user) {
      user = cookieAuth.user;
    } else {
      // If no cookie auth, try bearer token (desktop app)
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: tokenAuth } = await supabase.auth.getUser(token);
        if (tokenAuth?.user) {
          user = tokenAuth.user;
        }
      }
    }
    
    if (!user) {
      return new Response('Unauthorized', { 
        status: 401,
        headers 
      });
    }

    console.log('[Chat API] Authenticated user:', user.id);

    // Parse request
    const { messages, viewingDate } = await req.json();
    
    // Configure services for the user
    const factory = ServiceFactory.getInstance();
    try {
      factory.configure({
        userId: user.id,
        supabaseClient: supabase
      });
    } catch {
      // Factory might already be configured, just update the userId
      factory.updateUserId(user.id);
    }

    // Get AI orchestrator and process the message
    const orchestrator = getAIOrchestrator();
    await orchestrator.initialize();
    
    // Process message and get streaming response
    const result = await orchestrator.processMessage(messages, user.id, viewingDate);
    
    // Convert to data stream response
    const response = result.toDataStreamResponse();
    
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
    
  } catch (error) {
    console.error('[Chat API] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({
      error: 'Chat API Error',
      message: errorMessage,
    }), { 
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