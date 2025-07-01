'use client';

import { useState, useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { ChatPanel } from '@/modules/chat/components/ChatPanel';
import { SchedulePanel } from '@/modules/schedule/components/SchedulePanel';

export default function FocusPage() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  
  const handleResize = useCallback((size: number) => {
    // When dragged below 10%, collapse to 1%
    if (size < 10 && size > 1.5 && !isCollapsed) {
      setIsCollapsed(true);
      requestAnimationFrame(() => {
        if (chatPanelRef.current) {
          chatPanelRef.current.resize(1);
        }
      });
    }
  }, [isCollapsed]);
  
  const handleExpand = useCallback(() => {
    if (isCollapsed && chatPanelRef.current) {
      setIsCollapsed(false);
      chatPanelRef.current.resize(33);
    }
  }, [isCollapsed]);
  
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
    </div>
  );
} 