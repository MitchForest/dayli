import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase-server';
import { isTauri } from '@repo/shared/utils';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  console.log('[Middleware] Processing request:', pathname);
  
  // Allow auth callback to pass through without modification
  if (pathname.startsWith('/auth/')) {
    console.log('[Middleware] Auth callback, passing through');
    return NextResponse.next();
  }

  // Update/refresh the session
  const response = await updateSession(request);

  // For API routes, return the response as-is
  if (pathname.startsWith('/api/')) {
    return response;
  }

  // Check if we're in desktop environment
  const isDesktop = request.headers.get('user-agent')?.includes('Tauri') || false;

  // Protected routes that require authentication
  const protectedRoutes = ['/focus', '/settings'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute || pathname === '/') {
    // Check authentication by creating a client and getting user
    // Note: We import the middleware client creation here to avoid circular dependencies
    const { createMiddlewareClient } = await import('@/lib/supabase-server');
    const supabase = createMiddlewareClient(request, response);
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    console.log('[Middleware] Auth check:', {
      pathname,
      hasUser: !!user,
      userId: user?.id,
      error: error?.message,
      isDesktop
    });

    // Handle protected routes
    if (isProtectedRoute && !user) {
      console.log('[Middleware] Redirecting to login - no authenticated user');
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Handle login page - redirect if already authenticated
    if (pathname === '/login' && user) {
      console.log('[Middleware] Redirecting to focus - user is authenticated');
      const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/focus';
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    // Handle root page
    if (pathname === '/') {
      if (isDesktop) {
        // Desktop app: redirect to login or focus based on auth
        if (user) {
          console.log('[Middleware] Desktop root redirect to focus');
          return NextResponse.redirect(new URL('/focus', request.url));
        } else {
          console.log('[Middleware] Desktop root redirect to login');
          return NextResponse.redirect(new URL('/login', request.url));
        }
      } else {
        // Web: show marketing page if not authenticated
        if (user) {
          console.log('[Middleware] Web root redirect to focus (authenticated)');
          return NextResponse.redirect(new URL('/focus', request.url));
        }
        // Let unauthenticated users see the marketing page
        console.log('[Middleware] Web root - showing marketing page');
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}; 