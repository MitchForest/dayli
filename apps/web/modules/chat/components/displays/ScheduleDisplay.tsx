import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Coffee, Mail, Briefcase, Video, Ban, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { 
  ScheduleViewResponse, 
  CreateTimeBlockResponse, 
  MoveTimeBlockResponse,
  DeleteTimeBlockResponse,
  FillWorkBlockResponse 
} from '@/modules/ai/tools/types/responses';

interface ScheduleDisplayProps {
  toolName: string;
  data: any; // Will be one of the schedule response types
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const ScheduleDisplay = memo(function ScheduleDisplay({ 
  toolName,
  data, 
  onAction 
}: ScheduleDisplayProps) {
  // Handle different schedule tool responses
  if (toolName === 'schedule_viewSchedule') {
    return <ScheduleView data={data as ScheduleViewResponse} onAction={onAction} />;
  }
  if (toolName === 'schedule_createTimeBlock') {
    return <TimeBlockCreated data={data as CreateTimeBlockResponse} onAction={onAction} />;
  }
  if (toolName === 'schedule_moveTimeBlock') {
    return <TimeBlockMoved data={data as MoveTimeBlockResponse} onAction={onAction} />;
  }
  if (toolName === 'schedule_deleteTimeBlock') {
    return <TimeBlockDeleted data={data as DeleteTimeBlockResponse} onAction={onAction} />;
  }
  if (toolName === 'schedule_fillWorkBlock') {
    return <WorkBlockFilled data={data as FillWorkBlockResponse} onAction={onAction} />;
  }
  
  // Fallback for unknown schedule tools
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Schedule view component
interface ScheduleViewProps {
  data: ScheduleViewResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const ScheduleView = memo(function ScheduleView({ data, onAction }: ScheduleViewProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to load schedule'}</p>
        </div>
      </Card>
    );
  }

  const getBlockIcon = (type: string) => {
    const icons: Record<string, any> = {
      work: Briefcase,
      meeting: Video,
      email: Mail,
      break: Coffee,
      blocked: Ban,
    };
    return icons[type] || Clock;
  };
  
  const getBlockColor = (type: string) => {
    const colors: Record<string, string> = {
      work: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
      meeting: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
      email: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300',
      break: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
      blocked: 'bg-gray-500/10 border-gray-500/30 text-gray-700 dark:text-gray-300',
    };
    return colors[type] || 'bg-gray-100 border-gray-300';
  };
  
  const formatTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'h:mm a');
  };
  
  return (
    <div className="space-y-4">
      {/* Header with date and stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {format(new Date(data.date), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
        {data.stats && (
          <div className="flex gap-3 text-sm text-muted-foreground">
            <span>{data.blocks?.length || 0} blocks</span>
            <span>{data.stats.totalHours.toFixed(1)}h total</span>
            <span>{data.stats.utilization}% utilized</span>
          </div>
        )}
      </div>
      
      {/* Timeline */}
      <div className="space-y-2">
        {data.blocks?.map((block) => {
          const Icon = getBlockIcon(block.type);
          return (
            <Card
              key={block.id}
              className={`p-3 border cursor-pointer transition-all hover:shadow-sm ${getBlockColor(block.type)}`}
              onClick={() => onAction?.({ type: 'edit_block', payload: { blockId: block.id } })}
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium truncate">{block.title}</h4>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatTime(block.startTime)} - {formatTime(block.endTime)}
                    </span>
                  </div>
                  
                  {block.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {block.description}
                    </p>
                  )}
                  
                  {/* Show tasks for work blocks */}
                  {block.tasks && block.tasks.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {block.tasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={(e) => {
                              e.stopPropagation();
                              onAction?.({ 
                                type: 'toggle_task', 
                                payload: { taskId: task.id, completed: !task.completed } 
                              });
                            }}
                            className="h-3 w-3 rounded"
                          />
                          <span className={task.completed ? 'line-through opacity-60' : ''}>
                            {task.title}
                          </span>
                        </div>
                      ))}
                      {block.tasks.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{block.tasks.length - 3} more tasks
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          );
        })}
      </div>
      
      {/* Empty state */}
      {(!data.blocks || data.blocks.length === 0) && (
        <Card className="p-8 text-center">
          <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-3">No blocks scheduled for this date</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction?.({ type: 'create_block', payload: { date: data.date } })}
          >
            Create Time Block
          </Button>
        </Card>
      )}
      
      {/* Quick actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction?.({ type: 'create_block', payload: { date: data.date } })}
        >
          Add Block
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction?.({ type: 'optimize_schedule', payload: { date: data.date } })}
        >
          Optimize
        </Button>
      </div>
    </div>
  );
});

// Time block created component
interface TimeBlockCreatedProps {
  data: CreateTimeBlockResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const TimeBlockCreated = memo(function TimeBlockCreated({ data }: TimeBlockCreatedProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to create time block'}</p>
        </div>
      </Card>
    );
  }

  const formatTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'h:mm a');
  };
  
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-green-500/10">
          <Clock className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Time Block Created</h4>
          <p className="text-sm text-muted-foreground mt-1">
            "{data.block.title}" scheduled from {formatTime(data.block.startTime)} to {formatTime(data.block.endTime)}
          </p>
          {data.conflicts && data.conflicts.length > 0 && (
            <div className="mt-3 p-2 bg-yellow-500/10 rounded-md">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                ⚠️ Conflicts with {data.conflicts.length} existing block(s)
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

// Time block moved component
interface TimeBlockMovedProps {
  data: MoveTimeBlockResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const TimeBlockMoved = memo(function TimeBlockMoved({ data }: TimeBlockMovedProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to move time block'}</p>
        </div>
      </Card>
    );
  }

  const formatTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'h:mm a');
  };
  
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-blue-500/10">
          <Clock className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Time Block Moved</h4>
          <p className="text-sm text-muted-foreground mt-1">
            "{data.block.title}" moved from {formatTime(data.previousTime.startTime)}-{formatTime(data.previousTime.endTime)} 
            to {formatTime(data.block.startTime)}-{formatTime(data.block.endTime)}
          </p>
        </div>
      </div>
    </Card>
  );
});

// Time block deleted component
interface TimeBlockDeletedProps {
  data: DeleteTimeBlockResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const TimeBlockDeleted = memo(function TimeBlockDeleted({ data }: TimeBlockDeletedProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to delete time block'}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-red-500/10">
          <Ban className="h-4 w-4 text-red-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Time Block Deleted</h4>
          <p className="text-sm text-muted-foreground mt-1">
            "{data.deletedBlockTitle}" has been removed from your schedule
          </p>
        </div>
      </div>
    </Card>
  );
});

// Work block filled component
interface WorkBlockFilledProps {
  data: FillWorkBlockResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const WorkBlockFilled = memo(function WorkBlockFilled({ data }: WorkBlockFilledProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to fill work block'}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-green-500/10">
          <Briefcase className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Work Block Filled</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Added {data.assignedTasks?.length || 0} tasks • {data.utilization}% utilized • {data.remainingMinutes} minutes remaining
          </p>
          {data.assignedTasks && data.assignedTasks.length > 0 && (
            <div className="mt-3 space-y-1">
              {data.assignedTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">
                    {task.priority}
                  </Badge>
                  <span className="truncate">{task.title}</span>
                  <span className="text-muted-foreground">({task.estimatedMinutes}m)</span>
                </div>
              ))}
              {data.assignedTasks.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{data.assignedTasks.length - 3} more tasks
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

export default ScheduleDisplay;