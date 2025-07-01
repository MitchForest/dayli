'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ChatPanel } from '@/modules/chat/components/ChatPanel';
import { ScheduleCanvas } from '@/modules/schedule/components/ScheduleCanvas';

export default function FocusPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <PanelGroup 
        direction="horizontal"
        className="h-full"
        autoSaveId="dayli-panels"
      >
        {/* Schedule Canvas - Left Panel */}
        <Panel 
          defaultSize={67}
          minSize={50}
          order={1}
        >
          <div className="h-full w-full relative">
            <ScheduleCanvas />
          </div>
        </Panel>
        
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />
        
        {/* Chat Panel - Right Panel */}
        <Panel 
          defaultSize={33}
          minSize={5} // Minimum 5% for collapsed state (~40px on typical screen)
          maxSize={50}
          collapsible={true}
          collapsedSize={5}
          order={2}
        >
          <div className="h-full w-full bg-card border-l border-border">
            <ChatPanel />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
} 