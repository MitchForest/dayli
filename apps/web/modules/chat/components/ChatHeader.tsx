'use client';

import { Button } from '@/components/ui/button';
import { useChatStore } from '../store/chatStore';

export function ChatHeader() {
  const { clearMessages } = useChatStore();

  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <h2 className="text-lg font-semibold">AI Assistant</h2>
      <Button
        variant="ghost"
        size="sm"
        onClick={clearMessages}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Clear
      </Button>
    </div>
  );
} 