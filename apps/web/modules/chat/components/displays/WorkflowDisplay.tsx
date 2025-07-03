import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, TrendingUp, Mail, Calendar, CheckCircle2, 
  AlertCircle, Clock, ArrowRight, Sparkles, BarChart3 
} from 'lucide-react';
import type { 
  ScheduleResponse,
  WorkflowFillWorkBlockResponse,
  BaseToolResponse
} from '@/modules/ai/tools/types/responses';

// Define the FillEmailBlockResponse type since it's not in responses.ts yet
interface FillEmailBlockResponse extends BaseToolResponse {
  blockId: string;
  urgent: Array<{
    id: string;
    from: string;
    subject: string;
    reason: string;
  }>;
  batched: Array<{
    sender: string;
    count: number;
    emails: Array<{
      id: string;
      subject: string;
    }>;
  }>;
  archived: number;
  totalToProcess: number;
}

interface WorkflowDisplayProps {
  toolName: string;
  data: any; // Will be one of the workflow response types
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const WorkflowDisplay = memo(function WorkflowDisplay({ 
  toolName,
  data, 
  onAction 
}: WorkflowDisplayProps) {
  // Handle different workflow tool responses
  if (toolName === 'workflow_schedule') {
    return <ScheduleWorkflow data={data as ScheduleResponse} onAction={onAction} />;
  }
  if (toolName === 'workflow_fillWorkBlock') {
    return <FillWorkBlockWorkflow data={data as WorkflowFillWorkBlockResponse} onAction={onAction} />;
  }
  if (toolName === 'workflow_fillEmailBlock') {
    return <FillEmailBlockWorkflow data={data as FillEmailBlockResponse} onAction={onAction} />;
  }
  
  // Fallback for old workflows that are being removed
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
        </div>
        <div>
          <h4 className="font-medium">Legacy Workflow</h4>
          <p className="text-sm text-muted-foreground mt-1">
            This workflow is being replaced with the new simplified workflows
          </p>
        </div>
      </div>
    </Card>
  );
});

// Schedule workflow component
interface ScheduleWorkflowProps {
  data: ScheduleResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const ScheduleWorkflow = memo(function ScheduleWorkflow({ data, onAction }: ScheduleWorkflowProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to create schedule'}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-500/10">
            <Calendar className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Schedule Created</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {data.summary || `Created ${data.blocks.length} blocks for ${data.date}`}
            </p>
          </div>
        </div>
        
        {/* Show changes if any */}
        {data.changes && data.changes.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Changes Made:</h5>
            {data.changes.map((change, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-muted rounded-md">
                <Badge variant="outline" className="text-xs">
                  {change.action}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm">{change.block}</p>
                  {change.reason && (
                    <p className="text-xs text-muted-foreground mt-1">{change.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Show blocks */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium">Your Schedule:</h5>
          {data.blocks.map((block) => (
            <div key={block.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {block.type}
                </Badge>
                <span className="text-sm font-medium">{block.title}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {block.startTime} - {block.endTime} ({block.duration} min)
              </span>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={() => onAction?.({ 
              type: 'confirm_schedule', 
              payload: { date: data.date } 
            })}
          >
            Confirm Schedule
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction?.({ 
              type: 'adjust_schedule', 
              payload: { date: data.date } 
            })}
          >
            Make Adjustments
          </Button>
        </div>
      </div>
    </Card>
  );
});

// Fill work block workflow component
interface FillWorkBlockWorkflowProps {
  data: WorkflowFillWorkBlockResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const FillWorkBlockWorkflow = memo(function FillWorkBlockWorkflow({ data, onAction }: FillWorkBlockWorkflowProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to fill work block'}</p>
        </div>
      </Card>
    );
  }

  if (!data.tasks || data.tasks.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </div>
          <div>
            <h4 className="font-medium">No Tasks Available</h4>
            <p className="text-sm text-muted-foreground mt-1">
              No tasks found to fill this work block
            </p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-500/10">
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Work Block Filled</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Selected {data.tasks.length} tasks ({data.totalMinutes} minutes)
            </p>
          </div>
        </div>
        
        {/* Fit quality indicator */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Fit Quality:</span>
          <Badge 
            variant={data.fitQuality === 'perfect' ? 'default' : data.fitQuality === 'good' ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {data.fitQuality}
          </Badge>
        </div>
        
        {/* Selected tasks */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium">Selected Tasks:</h5>
          {data.tasks.map((task, idx) => (
            <div key={task.id} className="flex items-start gap-3 p-2 bg-muted rounded-md">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{task.title}</span>
                  <Badge 
                    variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} 
                    className="text-xs"
                  >
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Score: {task.score}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-muted-foreground">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {task.estimatedMinutes} minutes
                  </span>
                  {task.reason && (
                    <span className="text-xs text-muted-foreground">{task.reason}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={() => onAction?.({ 
              type: 'confirm_tasks', 
              payload: { blockId: data.blockId, taskIds: data.tasks.map(t => t.id) } 
            })}
          >
            Confirm Tasks
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction?.({ 
              type: 'select_different_tasks', 
              payload: { blockId: data.blockId } 
            })}
          >
            Select Different Tasks
          </Button>
        </div>
      </div>
    </Card>
  );
});

// Fill email block workflow component
interface FillEmailBlockWorkflowProps {
  data: FillEmailBlockResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const FillEmailBlockWorkflow = memo(function FillEmailBlockWorkflow({ data, onAction }: FillEmailBlockWorkflowProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to fill email block'}</p>
        </div>
      </Card>
    );
  }

  if (data.totalToProcess === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <h4 className="font-medium">Inbox Clear</h4>
            <p className="text-sm text-muted-foreground mt-1">
              No emails need processing right now
              {data.archived > 0 && ` (${data.archived} emails auto-archived)`}
            </p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-purple-500/10">
            <Mail className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Email Block Prepared</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {data.totalToProcess} emails to process
              {data.archived > 0 && ` (${data.archived} auto-archived)`}
            </p>
          </div>
        </div>
        
        {/* Urgent emails */}
        {data.urgent && data.urgent.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Urgent Emails ({data.urgent.length})
            </h5>
            {data.urgent.map((email) => (
              <div key={email.id} className="p-2 bg-red-50 dark:bg-red-950 rounded-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{email.from}</p>
                    <p className="text-sm text-muted-foreground">{email.subject}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs ml-2">
                    {email.reason}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Batched emails */}
        {data.batched && data.batched.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Batched by Sender</h5>
            {data.batched.map((batch, idx) => (
              <div key={idx} className="p-2 bg-muted rounded-md">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{batch.sender}</span>
                  <Badge variant="secondary" className="text-xs">
                    {batch.count} emails
                  </Badge>
                </div>
                <div className="space-y-1">
                  {batch.emails.slice(0, 2).map((email) => (
                    <p key={email.id} className="text-xs text-muted-foreground truncate">
                      • {email.subject}
                    </p>
                  ))}
                  {batch.emails.length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      +{batch.emails.length - 2} more
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={() => onAction?.({ 
              type: 'start_email_processing', 
              payload: { blockId: data.blockId } 
            })}
          >
            Start Processing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction?.({ type: 'view_all_emails' })}
          >
            View All Emails
          </Button>
        </div>
      </div>
    </Card>
  );
});

export default WorkflowDisplay;