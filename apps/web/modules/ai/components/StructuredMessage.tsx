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
import { 
  Clock, 
  Briefcase, 
  Video, 
  Mail, 
  Coffee, 
  Ban,
  CheckSquare,
  MapPin,
  Users,
  Sun,
  Cloud,
  Moon,
  Settings
} from 'lucide-react';
import { AICard } from './AICard';
import { AIList } from './AIList';
import { formatDistanceToNow } from 'date-fns';

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
            <ComponentRenderer key={idx} component={component} onAction={onAction} />
          ))}
        </DataCard>
      )}
      
      {display.type === 'list' && (
        <AIList
          title={display.title}
          description={display.description}
          items={display.components.map((component, idx) => (
            <ComponentRenderer key={idx} component={component} onAction={onAction} />
          ))}
        />
      )}
      
      {display.type === 'timeline' && (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold">{display.title}</h3>
            {display.description && (
              <p className="text-sm text-muted-foreground mt-1">{display.description}</p>
            )}
          </div>
          <TimelineRenderer components={display.components} onAction={onAction} />
        </div>
      )}
      
      {display.type === 'grid' && (
        <div>
          <h3 className="text-sm font-medium mb-2">{display.title}</h3>
          <div className="grid grid-cols-2 gap-2">
            {display.components.map((component, idx) => (
              <ComponentRenderer key={idx} component={component} onAction={onAction} />
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

// Timeline renderer for schedule blocks
function TimelineRenderer({ 
  components,
  onAction 
}: { 
  components: Component[];
  onAction?: (action: Action | { type: 'message'; message: string }) => void;
}) {
  // Group blocks by time period
  const morningBlocks: Component[] = [];
  const afternoonBlocks: Component[] = [];
  const eveningBlocks: Component[] = [];
  
  components.forEach(component => {
    if (component.type === 'scheduleBlock' && component.data?.startTime) {
      const hour = parseInt(component.data.startTime.split(':')[0] || '0');
      const isPM = component.data.startTime.includes('PM');
      
      if (hour === 12 && !isPM) {
        // 12 AM is midnight
        eveningBlocks.push(component);
      } else if (hour < 12 && !isPM) {
        morningBlocks.push(component);
      } else if (hour === 12 && isPM) {
        // 12 PM is noon
        afternoonBlocks.push(component);
      } else if ((hour >= 1 && hour < 5 && isPM) || (hour >= 1 && hour <= 4 && isPM)) {
        afternoonBlocks.push(component);
      } else {
        eveningBlocks.push(component);
      }
    }
  });
  
  const hasBlocks = morningBlocks.length > 0 || afternoonBlocks.length > 0 || eveningBlocks.length > 0;
  
  if (!hasBlocks) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No blocks scheduled for this day</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {morningBlocks.length > 0 && (
        <TimePeriodSection
          title="Morning"
          icon={<Sun className="h-4 w-4" />}
          blocks={morningBlocks}
          onAction={onAction}
        />
      )}
      
      {afternoonBlocks.length > 0 && (
        <TimePeriodSection
          title="Afternoon"
          icon={<Cloud className="h-4 w-4" />}
          blocks={afternoonBlocks}
          onAction={onAction}
        />
      )}
      
      {eveningBlocks.length > 0 && (
        <TimePeriodSection
          title="Evening"
          icon={<Moon className="h-4 w-4" />}
          blocks={eveningBlocks}
          onAction={onAction}
        />
      )}
    </div>
  );
}

// Time period section component
function TimePeriodSection({ 
  title, 
  icon, 
  blocks,
  onAction
}: { 
  title: string; 
  icon: React.ReactNode;
  blocks: Component[];
  onAction?: (action: Action | { type: 'message'; message: string }) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-2 ml-6">
        {blocks.map((block, idx) => (
          <ComponentRenderer key={idx} component={block} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

// Component renderer for different component types
function ComponentRenderer({ 
  component, 
  onAction 
}: { 
  component: Component;
  onAction?: (action: Action | { type: 'message'; message: string }) => void;
}) {
  switch (component.type) {
    case 'scheduleBlock':
      return <ScheduleBlockComponent data={component.data} />;
    case 'taskCard':
      return <TaskCardComponent data={component.data} onAction={onAction} />;
    case 'emailPreview':
      return <EmailPreviewComponent data={component.data} onAction={onAction} />;
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

// Enhanced schedule block component
function ScheduleBlockComponent({ data }: { data: any }) {
  const getBlockIcon = () => {
    switch (data.type) {
      case 'work':
        return <Briefcase size={14} className="text-blue-700" />;
      case 'meeting':
        return <Video size={14} className="text-red-700" />;
      case 'email':
        return <Mail size={14} className="text-purple-700" />;
      case 'break':
        return <Coffee size={14} className="text-green-700" />;
      case 'blocked':
        return <Ban size={14} className="text-gray-600" />;
      default:
        return <Clock size={14} className="text-gray-600" />;
    }
  };
  
  const getBlockColorClasses = () => {
    switch (data.type) {
      case 'work':
        return {
          bg: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-950/20 dark:to-blue-900/20',
          border: 'border-blue-500/20',
          text: 'text-blue-900 dark:text-blue-100',
          hover: 'hover:from-blue-200 hover:to-blue-300 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30',
          shadow: 'hover:shadow-blue-300/20'
        };
      case 'meeting':
        return {
          bg: 'bg-gradient-to-br from-red-100 to-red-200 dark:from-red-950/20 dark:to-red-900/20',
          border: 'border-red-500/20',
          text: 'text-red-900 dark:text-red-100',
          hover: 'hover:from-red-200 hover:to-red-300 dark:hover:from-red-900/30 dark:hover:to-red-800/30',
          shadow: 'hover:shadow-red-300/20'
        };
      case 'email':
        return {
          bg: 'bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-950/20 dark:to-purple-900/20',
          border: 'border-purple-500/20',
          text: 'text-purple-900 dark:text-purple-100',
          hover: 'hover:from-purple-200 hover:to-purple-300 dark:hover:from-purple-900/30 dark:hover:to-purple-800/30',
          shadow: 'hover:shadow-purple-300/20'
        };
      case 'break':
        return {
          bg: 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-950/20 dark:to-green-900/20',
          border: 'border-green-500/20',
          text: 'text-green-900 dark:text-green-100',
          hover: 'hover:from-green-200 hover:to-green-300 dark:hover:from-green-900/30 dark:hover:to-green-800/30',
          shadow: 'hover:shadow-green-300/20'
        };
      case 'blocked':
        return {
          bg: 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800/20 dark:to-gray-700/20',
          border: 'border-gray-400/30',
          text: 'text-gray-800 dark:text-gray-200',
          hover: '',
          shadow: ''
        };
      default:
        return {
          bg: 'bg-muted',
          border: 'border-border',
          text: 'text-foreground',
          hover: 'hover:bg-muted/80',
          shadow: ''
        };
    }
  };
  
  const colors = getBlockColorClasses();
  const duration = data.endTime && data.startTime ? 
    `${parseInt(data.endTime.split(':')[0]) - parseInt(data.startTime.split(':')[0])} hours` : '';
  
  return (
    <div className={cn(
      "rounded-md border p-2 transition-all duration-200",
      "shadow-sm overflow-hidden",
      colors.bg,
      colors.border,
      colors.text,
      colors.hover,
      colors.shadow && `hover:shadow-md ${colors.shadow}`
    )}>
      <div className="flex flex-col">
        {/* Header - Icon and time on same row */}
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {getBlockIcon()}
          <span>{data.startTime} - {data.endTime}</span>
        </div>
        
        {/* Title - Below header */}
        <div className="text-sm font-semibold mt-0.5 truncate">
          {data.title}
        </div>
        
        {/* Additional info based on block type */}
        {data.type === 'work' && data.tasks && data.tasks.length > 0 && (
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1 text-xs opacity-80">
              <CheckSquare size={12} />
              <span>{data.tasks.filter((t: any) => t.completed).length}/{data.tasks.length} tasks</span>
            </div>
            {data.tasks.slice(0, 2).map((task: any, idx: number) => (
              <div
                key={task.id || idx}
                className={cn(
                  "text-xs truncate pl-4",
                  task.completed ? "line-through opacity-60" : ""
                )}
              >
                • {task.title}
              </div>
            ))}
            {data.tasks.length > 2 && (
              <div className="text-xs pl-4 opacity-60">
                +{data.tasks.length - 2} more
              </div>
            )}
          </div>
        )}
        
        {data.type === 'meeting' && (
          <div className="mt-1 space-y-0.5 text-xs opacity-80">
            {data.attendees && data.attendees.length > 0 && (
              <div className="truncate">
                {data.attendees.length === 1 ? data.attendees[0] : `${data.attendees.length} attendees`}
              </div>
            )}
            {data.videoLink && (
              <div className="flex items-center gap-1">
                <Video size={12} />
                <span>Video call</span>
              </div>
            )}
            {data.location && !data.videoLink && (
              <div className="flex items-center gap-1">
                <MapPin size={12} />
                <span className="truncate">{data.location}</span>
              </div>
            )}
          </div>
        )}
        
        {data.type === 'email' && data.emailQueue && data.emailQueue.length > 0 && (
          <div className="mt-1 text-xs opacity-80">
            {data.emailQueue.length} {data.emailQueue.length === 1 ? 'email' : 'emails'} to process
          </div>
        )}
        
        {data.type === 'break' && (
          <div className="mt-1 text-xs opacity-80">
            {data.description || `${duration} break`}
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced task card component
function TaskCardComponent({ 
  data,
  onAction 
}: { 
  data: any;
  onAction?: (action: Action | { type: 'message'; message: string }) => void;
}) {
  return (
    <AICard
      type="task"
      title={data.title}
      priority={data.priority}
      description={data.description || data.reasoning}
      data={{
        estimatedMinutes: data.estimatedMinutes,
        score: data.score || data.fitScore,
        status: data.status,
      }}
      actions={data.id ? [
        {
          label: 'Assign to Block',
          onClick: () => {
            onAction?.({
              type: 'message',
              message: `Assign task "${data.title}" to a time block`
            });
          }
        }
      ] : []}
    />
  );
}

// Enhanced email preview component
function EmailPreviewComponent({ 
  data,
  onAction 
}: { 
  data: any;
  onAction?: (action: Action | { type: 'message'; message: string }) => void;
}) {
  const timeAgo = data.receivedAt ? formatDistanceToNow(new Date(data.receivedAt), { addSuffix: true }) : '';
  
  return (
    <AICard
      type="email"
      title={data.subject}
      subtitle={`From: ${data.from} (${data.fromEmail})`}
      description={data.preview}
      badge={!data.isRead ? { text: 'Unread', variant: 'default' } : undefined}
      metadata={[
        { text: timeAgo }
      ]}
      data={{
        urgency: data.urgency,
        hasAttachments: data.hasAttachments,
        isRead: data.isRead,
      }}
      actions={[
        {
          label: 'Read',
          onClick: () => onAction?.({
            type: 'message',
            message: `Read email with ID ${data.id}`
          })
        },
        {
          label: 'Reply',
          onClick: () => onAction?.({
            type: 'message',
            message: `Reply to email from ${data.from}`
          })
        }
      ]}
    />
  );
}

// Enhanced meeting card component
function MeetingCardComponent({ data }: { data: any }) {
  return (
    <AICard
      type="meeting"
      title={data.title}
      subtitle={`${data.date} • ${data.startTime} - ${data.endTime}`}
      description={data.description}
      badge={data.hasConflicts ? { text: 'Conflict', variant: 'destructive' } : undefined}
      data={{
        attendees: data.attendees,
        location: data.location,
        meetingUrl: data.meetingUrl,
      }}
      actions={
        data.meetingUrl ? [
          {
            label: 'Join Meeting',
            onClick: () => {
              window.open(data.meetingUrl, '_blank');
            }
          }
        ] : []
      }
    />
  );
}

// Preference form component
function PreferenceFormComponent({ data }: { data: any }) {
  const getIcon = () => {
    switch (data.category) {
      case 'schedule':
        return <Clock className="h-4 w-4" />;
      case 'work':
        return <Briefcase className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };
  
  return (
    <div className="p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2">
        {getIcon()}
        <div className="flex-1">
          <div className="text-sm font-medium">{data.label}</div>
          <div className="text-sm text-muted-foreground">{data.value}</div>
        </div>
      </div>
    </div>
  );
}

// Progress indicator component
function ProgressIndicatorComponent({ data }: { data: any }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{data.label}</span>
        <span className="font-medium">{data.percentage}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${data.percentage}%` }}
        />
      </div>
      {data.description && (
        <p className="text-xs text-muted-foreground mt-1">{data.description}</p>
      )}
    </div>
  );
}

// Confirmation dialog component
function ConfirmationDialogComponent({ data }: { data: any }) {
  const getVariantStyles = () => {
    switch (data.variant) {
      case 'danger':
        return 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20';
      case 'info':
        return 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20';
      default:
        return 'border-border bg-muted/30';
    }
  };
  
  return (
    <div className={cn(
      "p-4 rounded-lg border-2",
      getVariantStyles()
    )}>
      <div className="font-medium text-sm">{data.title}</div>
      <div className="text-sm mt-1 text-muted-foreground">{data.message}</div>
      {data.details && (
        <div className="text-xs mt-2 text-muted-foreground">
          {data.details}
        </div>
      )}
    </div>
  );
} 