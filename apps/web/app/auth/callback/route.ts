import { createServerActionClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  console.log('[Auth Callback] Processing callback with code:', !!code);

  if (code) {
    const supabase = await createServerActionClient();
    
    try {
      // Exchange code for session - PKCE verifier handled by cookies
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('[Auth Callback] Error exchanging code:', error);
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
      }
      
      console.log('[Auth Callback] Successfully exchanged code for session');
    } catch (error) {
      console.error('[Auth Callback] Unexpected error:', error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Authentication failed')}`);
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/focus`);
} 