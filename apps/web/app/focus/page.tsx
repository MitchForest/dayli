'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ChatPanel } from '@/modules/chat/components/ChatPanel';
import { SchedulePanel } from '@/modules/schedule/components/SchedulePanel';

export default function FocusPage() {
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
        
        <PanelResizeHandle className="w-1 bg-border hover:bg-border/80 transition-colors" />
        
        <Panel
          defaultSize={33}
          minSize={20}
          maxSize={50}
          className="h-full"
        >
          <ChatPanel />
        </Panel>
      </PanelGroup>
    </div>
  );
} 