'use client';

import { cn } from '@/lib/utils';
import { parseMessageContent } from '../utils/messageParser';
import { EntityChip } from './EntityChip';
import { ChatScheduleDisplay } from './ChatScheduleDisplay';
import { SuggestionButtons } from './SuggestionButtons';
import { MessageStreamingProgress } from './StreamingProgress';
import type { Entity, MessageMetadata, ListItem } from '../types/chat.types';
import type { TimeBlock } from '@/modules/schedule/types/schedule.types';
import { memo, useCallback } from 'react';

interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: MessageMetadata;
  message?: any; // Full message object for streaming progress
  onEntityClick?: (entity: Entity) => void;
  onSuggestionSelect?: (suggestion: string) => void;
  className?: string;
  isLoading?: boolean;
}

export const MessageContent = memo(function MessageContent({
  content,
  role,
  metadata,
  message,
  onEntityClick,
  onSuggestionSelect,
  className,
  isLoading = false
}: MessageContentProps) {
  // Parse the content to identify entities and structure
  const { segments } = parseMessageContent(content, metadata?.entities);

  const handleEntityClick = useCallback((entity: Entity) => {
    onEntityClick?.(entity);
  }, [onEntityClick]);

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    onSuggestionSelect?.(suggestion);
  }, [onSuggestionSelect]);

  return (
    <div className={cn('message-content', className)}>
      {/* Render parsed segments */}
      <div className={cn(
        'text-sm',
        role === 'assistant' && 'select-text' // AI messages selectable
      )}>
        {segments.map((segment, idx) => {
          switch (segment.type) {
            case 'text':
              return (
                <span key={idx} className="whitespace-pre-wrap">
                  {segment.value}
                </span>
              );

            case 'entity':
              return segment.entity ? (
                <EntityChip
                  key={idx}
                  entity={segment.entity}
                  onClick={handleEntityClick}
                />
              ) : null;

            case 'list':
              return segment.items ? (
                <StructuredList key={idx} items={segment.items} />
              ) : null;

            case 'schedule':
              return segment.blocks ? (
                <ChatScheduleDisplay
                  key={idx}
                  blocks={segment.blocks}
                  groupByPeriod={true}
                  className="my-3"
                />
              ) : null;

            case 'code':
              return (
                <CodeBlock
                  key={idx}
                  code={segment.value || ''}
                  language={segment.language}
                />
              );

            default:
              return null;
          }
        })}
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

// Structured list component for bullet points
function StructuredList({ items }: { items: ListItem[] }) {
  return (
    <div className="my-2 space-y-1">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="flex items-start gap-2 text-sm"
          >
            {Icon && (
              <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1">
              <div>{item.title}</div>
              {item.subtitle && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.subtitle}
                </div>
              )}
            </div>
            {item.time && (
              <span className="text-xs text-muted-foreground">
                {item.time}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Simple code block component
function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <pre className="my-2 p-3 bg-muted rounded-md overflow-x-auto">
      <code className="text-xs font-mono">
        {code}
      </code>
    </pre>
  );
}

export default MessageContent; 