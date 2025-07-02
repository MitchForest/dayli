'use client';

import { memo } from 'react';
import { type z } from 'zod';
import { type universalToolResponseSchema, type Component, type Action } from '../schemas/universal.schema';
import { DataCard } from './DataCard';
import { ProgressStream } from './ProgressStream';
import { ErrorDisplay } from './ErrorDisplay';
import { ActionButtons } from './ActionButtons';
import { SuggestionButtons } from '@/modules/chat/components/SuggestionButtons';
import { cn } from '@/lib/utils';

interface StructuredMessageProps {
  response: z.infer<typeof universalToolResponseSchema>;
  onAction?: (action: Action | { type: 'message'; message: string }) => void;
  className?: string;
}

export const StructuredMessage = memo(function StructuredMessage({ 
  response, 
  onAction,
  className 
}: StructuredMessageProps) {
  const { display, ui, streaming, error } = response;
  
  // Show error state
  if (error) {
    return <ErrorDisplay error={error} className={className} />;
  }
  
  // Show streaming progress
  if (streaming?.supported && streaming.progress !== undefined && streaming.progress < 100) {
    return (
      <ProgressStream
        progress={streaming.progress}
        stage={streaming.stage}
        title={display.title}
        className={className}
      />
    );
  }
  
  return (
    <div className={cn('structured-message space-y-3', className)}>
      {/* Render based on display type */}
      {display.type === 'card' && (
        <DataCard
          title={display.title}
          description={display.description}
          priority={display.priority}
        >
          {display.components.map((component, idx) => (
            <ComponentRenderer key={idx} component={component} />
          ))}
        </DataCard>
      )}
      
      {display.type === 'list' && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{display.title}</h3>
          {display.description && (
            <p className="text-sm text-muted-foreground">{display.description}</p>
          )}
          <div className="space-y-1">
            {display.components.map((component, idx) => (
              <ComponentRenderer key={idx} component={component} />
            ))}
          </div>
        </div>
      )}
      
      {display.type === 'grid' && (
        <div>
          <h3 className="text-sm font-medium mb-2">{display.title}</h3>
          <div className="grid grid-cols-2 gap-2">
            {display.components.map((component, idx) => (
              <ComponentRenderer key={idx} component={component} />
            ))}
          </div>
        </div>
      )}
      
      {/* Action buttons */}
      {ui.actions.length > 0 && (
        <ActionButtons
          actions={ui.actions}
          onAction={onAction}
          className="mt-3"
        />
      )}
      
      {/* Suggestions */}
      {ui.suggestions.length > 0 && (
        <SuggestionButtons
          suggestions={ui.suggestions}
          onSelect={(s: string) => onAction?.({ type: 'message', message: s })}
        />
      )}
    </div>
  );
});

// Component renderer for different component types
function ComponentRenderer({ component }: { component: Component }) {
  switch (component.type) {
    case 'scheduleBlock':
      return <ScheduleBlockComponent data={component.data} />;
    case 'taskCard':
      return <TaskCardComponent data={component.data} />;
    case 'emailPreview':
      return <EmailPreviewComponent data={component.data} />;
    case 'meetingCard':
      return <MeetingCardComponent data={component.data} />;
    case 'preferenceForm':
      return <PreferenceFormComponent data={component.data} />;
    case 'progressIndicator':
      return <ProgressIndicatorComponent data={component.data} />;
    case 'confirmationDialog':
      return <ConfirmationDialogComponent data={component.data} />;
    default:
      return null;
  }
}

// Individual component implementations (simplified for now)
function ScheduleBlockComponent({ data }: { data: any }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <div className="flex items-center justify-between">
        <span className="font-medium">{data.title}</span>
        <span className="text-sm text-muted-foreground">
          {data.startTime} - {data.endTime}
        </span>
      </div>
    </div>
  );
}

function TaskCardComponent({ data }: { data: any }) {
  return (
    <div className="p-3 rounded-lg border">
      <div className="font-medium">{data.title}</div>
      <div className="text-sm text-muted-foreground">
        {data.estimatedMinutes} min • {data.priority} priority
      </div>
    </div>
  );
}

function EmailPreviewComponent({ data }: { data: any }) {
  return (
    <div className="p-3 rounded-lg border">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium">{data.from}</div>
          <div className="text-sm">{data.subject}</div>
          <div className="text-sm text-muted-foreground line-clamp-2">{data.preview}</div>
        </div>
        {data.hasAttachments && (
          <div className="text-xs text-muted-foreground">📎</div>
        )}
      </div>
    </div>
  );
}

function MeetingCardComponent({ data }: { data: any }) {
  return (
    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
      <div className="font-medium">{data.title}</div>
      <div className="text-sm text-muted-foreground">
        {data.startTime} - {data.endTime}
      </div>
      {data.attendees && (
        <div className="text-sm text-muted-foreground">
          {data.attendees.length} attendees
        </div>
      )}
    </div>
  );
}

function PreferenceFormComponent({ data }: { data: any }) {
  return (
    <div className="p-3 rounded-lg border">
      <div className="font-medium">{data.label}</div>
      <div className="text-sm text-muted-foreground">{data.value}</div>
    </div>
  );
}

function ProgressIndicatorComponent({ data }: { data: any }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{data.label}</span>
        <span>{data.percentage}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all"
          style={{ width: `${data.percentage}%` }}
        />
      </div>
    </div>
  );
}

function ConfirmationDialogComponent({ data }: { data: any }) {
  return (
    <div className="p-4 rounded-lg border-2 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
      <div className="font-medium">{data.title}</div>
      <div className="text-sm mt-1">{data.message}</div>
    </div>
  );
} 