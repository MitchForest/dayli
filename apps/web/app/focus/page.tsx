'use client';

import { useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { useChatStore } from '@/modules/chat/store/chatStore';
import { ChatPanel } from '@/modules/chat/components/ChatPanel';
import { SchedulePanel } from '@/modules/schedule/components/SchedulePanel';
import { DailyPlanningTrigger } from '@/modules/schedule/components/DailyPlanningTrigger';
import { useAuth } from '@repo/auth/hooks';

export default function FocusPage() {
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const isCollapsed = useChatStore(state => state.isCollapsed);
  const toggleCollapsed = useChatStore(state => state.toggleCollapsed);
  const { loading } = useAuth();
  
  // Handle panel resize
  const handleResize = (size: number) => {
    if (size < 5 && !isCollapsed) {
      toggleCollapsed();
    } else if (size >= 5 && isCollapsed) {
      toggleCollapsed();
    }
  };
  
  // Handle expanding from collapsed state
  const handleExpand = () => {
    if (isCollapsed && chatPanelRef.current) {
      toggleCollapsed();
      // Expand to 33% when clicking
      chatPanelRef.current.resize(33);
    }
  };
  
  // Show loading state while auth is being verified
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <PanelGroup direction="horizontal" className="h-full">
        <Panel 
          defaultSize={67} 
          minSize={50}
          className="h-full"
        >
          <SchedulePanel />
        </Panel>
        
        <PanelResizeHandle 
          disabled={isCollapsed}
          className={`w-1 bg-border transition-colors ${isCollapsed ? '' : 'hover:bg-border/80 cursor-col-resize'}`} 
        />
        
        <Panel
          ref={chatPanelRef}
          defaultSize={33}
          minSize={1}
          maxSize={50}
          onResize={handleResize}
          className="h-full"
        >
          <div 
            className={`h-full border-l border-border ${isCollapsed ? 'cursor-pointer hover:bg-accent/10' : ''}`}
            onClick={isCollapsed ? handleExpand : undefined}
          >
            {!isCollapsed && <ChatPanel />}
          </div>
        </Panel>
      </PanelGroup>
      
      {/* Daily Planning Trigger */}
      <DailyPlanningTrigger />
    </div>
  );
} 