'use client';

import { useEffect, useState, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export function ChatPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect if panel is collapsed based on width
  useEffect(() => {
    const checkWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        // Consider collapsed if less than 100px
        setIsCollapsed(width < 100);
      }
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    
    // Also check on panel resize
    const resizeObserver = new ResizeObserver(checkWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkWidth);
      resizeObserver.disconnect();
    };
  }, []);

  if (isCollapsed) {
    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs rotate-90 origin-center whitespace-nowrap">AI Chat</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-card">
      <ChatHeader />
      <MessageList />
      <ChatInput />
    </div>
  );
} 