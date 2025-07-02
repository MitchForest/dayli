'use client';

import { cn } from '@/lib/utils';
import { SuggestionButtons } from './SuggestionButtons';
import { MessageStreamingProgress } from './StreamingProgress';
import { StructuredMessage } from '@/modules/ai/components';
import type { MessageMetadata } from '../types/chat.types';
import type { UniversalToolResponse } from '@/modules/ai/schemas/universal.schema';
import { memo, useCallback } from 'react';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: MessageMetadata;
  message?: any; // Full message object for streaming progress
  structuredData?: UniversalToolResponse | UniversalToolResponse[]; // New prop for structured responses
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
  structuredData,
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
    hasStructuredData: !!structuredData,
    structuredDataType: Array.isArray(structuredData) ? 'array' : typeof structuredData,
    contentLength: content?.length,
    role
  });

  // If we have structured data, render it using the new components
  if (structuredData) {
    const responses = Array.isArray(structuredData) ? structuredData : [structuredData];
    console.log('[MessageContent] Rendering structured responses:', responses);
    
    return (
      <div className={cn('message-content', className)}>
        {/* Render any conversational text first */}
        {content && content.trim() && (
          <div className="text-sm whitespace-pre-wrap mb-3">
            {content}
          </div>
        )}
        
        {/* Render structured responses */}
        <div className="space-y-3">
          {responses.map((response, idx) => (
            <StructuredMessage
              key={idx}
              response={response}
              onAction={onAction}
            />
          ))}
        </div>
        
        {/* Streaming progress for long operations */}
        {message && <MessageStreamingProgress message={message} />}
      </div>
    );
  }

  // No structured data, just render plain text
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