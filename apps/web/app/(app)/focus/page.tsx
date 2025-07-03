'use client';

import { useAuth } from '@repo/auth/hooks';
import { redirect } from 'next/navigation';
import { SchedulePanel } from '@/modules/schedule/components/SchedulePanel';
import { ChatPanel } from '@/modules/chat/components/ChatPanel';
import { ScheduleSkeleton } from '@/components/skeletons/ScheduleSkeleton';
import { ChatSkeleton } from '@/components/skeletons/ChatSkeleton';

export default function FocusPage() {
  const { user, loadingStates } = useAuth();

  // Only block on session loading, not profile
  if (loadingStates.session) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Initializing...</div>
      </div>
    );
  }

  // Redirect if no user (after session check is complete)
  if (!loadingStates.session && !user) {
    redirect('/login');
  }

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