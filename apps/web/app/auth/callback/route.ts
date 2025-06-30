import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/focus';

  // If Google returns an error, handle it
  const error_description = searchParams.get('error_description');
  if (error_description) {
    return NextResponse.redirect(`${origin}/login?error=OAuth%20error&message=${encodeURIComponent(error_description)}`);
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    // If Supabase returns an error, handle it
    console.error('Supabase auth error:', error);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.name)}&message=${encodeURIComponent(error.message)}`);
  }

  // Fallback for other issues (e.g., no code)
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error&message=A%20server%20error%20occurred.`);
} 