'use client';

import { cn } from '@/lib/utils';
import { SuggestionButtons } from './SuggestionButtons';
import { MessageStreamingProgress } from './StreamingProgress';
import type { MessageMetadata } from '../types/chat.types';
import { memo, useCallback } from 'react';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: MessageMetadata;
  message?: any; // Full message object for streaming progress
  onSuggestionSelect?: (suggestion: string) => void;
  onAction?: (action: any) => void; // New prop for handling actions
  className?: string;
  isLoading?: boolean;
}

export const MessageContent = memo(function MessageContent({
  content,
  role,
  metadata,
  message,
  onSuggestionSelect,
  onAction,
  className,
  isLoading = false
}: MessageContentProps) {
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    onSuggestionSelect?.(suggestion);
  }, [onSuggestionSelect]);

  // Debug logging
  console.log('[MessageContent] Rendering with:', {
    contentLength: content?.length,
    role
  });

  return (
    <div className={cn('message-content', className)}>
      {/* Render plain text content */}
      <div className={cn(
        'text-sm whitespace-pre-wrap',
        role === 'assistant' && 'select-text' // AI messages selectable
      )}>
        {content}
      </div>

      {/* Streaming progress for long operations */}
      {message && <MessageStreamingProgress message={message} />}

      {/* Render suggestions if available */}
      {metadata?.suggestions && metadata.suggestions.length > 0 && (
        <SuggestionButtons
          suggestions={metadata.suggestions}
          onSelect={handleSuggestionSelect}
          isLoading={isLoading}
          className="mt-3"
        />
      )}

      {/* Render error if present */}
      {metadata?.error && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
          {metadata.error}
        </div>
      )}
    </div>
  );
});

export default MessageContent; 