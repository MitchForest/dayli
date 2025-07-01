'use client';

import { Button } from '@/components/ui/button';

interface ChatHeaderProps {
  onClear?: () => void;
}

export function ChatHeader({ onClear }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <h2 className="text-lg font-semibold">AI Assistant</h2>
      {onClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </Button>
      )}
    </div>
  );
} 