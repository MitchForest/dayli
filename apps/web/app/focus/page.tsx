'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ChatPanel } from '@/modules/chat/components/ChatPanel';
import { ScheduleCanvas } from '@/modules/schedule/components/ScheduleCanvas';
import { DateNavigator } from '@/modules/schedule/components/DateNavigator';
import { UserMenu } from '@/components/user-menu';

export default function FocusPage() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Panel Layout */}
      <PanelGroup direction="horizontal">
        <Panel defaultSize={67} minSize={50} className="relative overflow-hidden">
          <ScheduleCanvas />
        </Panel>
        <PanelResizeHandle className="w-[2px] bg-border" />
        <Panel
          defaultSize={33}
          minSize={5}
          maxSize={50}
          className="relative overflow-hidden"
        >
          <div className="h-full bg-card border-l border-border">
            <ChatPanel />
          </div>
        </Panel>
      </PanelGroup>
      
      {/* Floating UI Elements - On top of both panels */}
      <DateNavigator />
      <UserMenu />
    </div>
  );
} 