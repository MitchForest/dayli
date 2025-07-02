import { NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/focus';
  const error_description = searchParams.get('error_description');

  console.log('[Auth Callback] Processing callback:', {
    hasCode: !!code,
    hasError: !!error_description,
    next,
    url: request.url
  });

  // Check for PKCE verifier cookie
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log('[Auth Callback] Available cookies:', allCookies.map(c => ({
    name: c.name,
    hasValue: !!c.value,
    length: c.value?.length
  })));

  // Look specifically for the code verifier cookie
  const verifierCookie = allCookies.find(c => c.name.includes('code-verifier'));
  console.log('[Auth Callback] Code verifier cookie:', {
    found: !!verifierCookie,
    name: verifierCookie?.name,
    hasValue: !!verifierCookie?.value
  });

  // Handle OAuth errors from provider
  if (error_description) {
    console.error('[Auth Callback] OAuth provider error:', error_description);
    return NextResponse.redirect(
      `${origin}/login?error=OAuth%20error&message=${encodeURIComponent(error_description)}`
    );
  }

  if (code) {
    try {
      const supabase = await createServerActionClient();
      
      // Exchange the code for a session
      // The PKCE verifier is automatically handled by the SSR package
      console.log('[Auth Callback] Exchanging code for session...');
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('[Auth Callback] Exchange error:', {
          error: error.message,
          code: error.code,
          status: error.status,
          name: error.name,
          cause: error.cause,
          stack: error.stack
        });
        
        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.message.includes('code verifier')) {
          errorMessage = 'Authentication failed. Please try logging in again.';
          console.error('[Auth Callback] PKCE verification failed - code verifier issue');
        }
        
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(error.name || 'auth_error')}&message=${encodeURIComponent(errorMessage)}`
        );
      }
      
      console.log('[Auth Callback] Successfully exchanged code for session:', {
        userId: data.user?.id,
        email: data.user?.email,
        provider: data.user?.app_metadata?.provider
      });
      
      // Successful authentication - redirect to intended destination
      return NextResponse.redirect(`${origin}${next}`);
    } catch (error) {
      console.error('[Auth Callback] Unexpected error:', error);
      return NextResponse.redirect(
        `${origin}/login?error=auth_callback_error&message=An%20unexpected%20error%20occurred.%20Please%20try%20again.`
      );
    }
  }

  // No code provided - invalid callback
  console.error('[Auth Callback] No authorization code provided');
  return NextResponse.redirect(
    `${origin}/login?error=auth_callback_error&message=No%20authorization%20code%20provided.%20Please%20try%20logging%20in%20again.`
  );
} 