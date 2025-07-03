'use client';

import { useAuth } from '@repo/auth/hooks';
import { useRouter } from 'next/navigation';
import { SchedulePanel } from '@/modules/schedule/components/SchedulePanel';
import { ChatPanel } from '@/modules/chat/components/ChatPanel';
import { ScheduleSkeleton } from '@/components/skeletons/ScheduleSkeleton';
import { ChatSkeleton } from '@/components/skeletons/ChatSkeleton';
import { useEffect } from 'react';

export default function FocusPage() {
  const { user, loading, loadingStates } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[FocusPage] Auth state:', {
      user: !!user,
      userId: user?.id,
      loading,
      loadingStates
    });
  }, [user, loading, loadingStates]);

  // Handle redirect in useEffect to avoid hooks error
  useEffect(() => {
    // Only redirect if we're sure there's no user and not loading
    if (!loading && !loadingStates.session && !user) {
      console.log('[FocusPage] No user, redirecting to login');
      router.push('/login');
    }
  }, [user, loading, loadingStates.session, router]);

  // Check main loading state first
  if (loading) {
    console.log('[FocusPage] Main loading is true, showing initializing...');
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Initializing...</div>
      </div>
    );
  }

  // Only block on session loading, not profile
  if (loadingStates.session) {
    console.log('[FocusPage] Session loading is true, showing initializing...');
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Initializing...</div>
      </div>
    );
  }

  // Show loading state while redirecting
  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  console.log('[FocusPage] Rendering main content');
  
  // Show the page optimistically while profile loads
  return (
    <div className="flex h-screen w-screen bg-background">
      {/* Schedule Panel - Left Side */}
      <div className="w-1/2 h-full border-r border-border/50 bg-card/30">
        {loadingStates.profile ? <ScheduleSkeleton /> : <SchedulePanel />}
      </div>

      {/* Chat Panel - Right Side */}
      <div className="w-1/2 h-full bg-background">
        {loadingStates.profile ? <ChatSkeleton /> : <ChatPanel />}
      </div>
    </div>
  );
} 