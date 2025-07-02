import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase-server';

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
      error: error?.message
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
      if (user) {
        console.log('[Middleware] Root redirect to focus');
        return NextResponse.redirect(new URL('/focus', request.url));
      } else {
        console.log('[Middleware] Root redirect to login');
        return NextResponse.redirect(new URL('/login', request.url));
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