import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, TrendingUp, Mail, Calendar, CheckCircle2, 
  AlertCircle, Clock, ArrowRight, Sparkles, BarChart3 
} from 'lucide-react';
import { format } from 'date-fns';
import ProposalDisplay from './ProposalDisplay';
import type { 
  ScheduleResponse,
  WorkflowScheduleResponse,
  WorkflowFillWorkBlockResponse,
  WorkflowFillEmailBlockResponse,
  BaseToolResponse
} from '@/modules/ai/tools/types/responses';

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
  // Handle proposal phase for all workflows
  if (data.phase === 'proposal' && data.requiresConfirmation) {
    return <ProposalDisplay toolName={toolName} data={data} onAction={onAction} />;
  }
  
  // Handle different workflow tool responses for completed phase
  if (toolName === 'workflow_schedule') {
    return <ScheduleWorkflow data={data as WorkflowScheduleResponse} onAction={onAction} />;
  }
  if (toolName === 'workflow_fillWorkBlock') {
    return <FillWorkBlockWorkflow data={data as WorkflowFillWorkBlockResponse} onAction={onAction} />;
  }
  if (toolName === 'workflow_fillEmailBlock') {
    return <FillEmailBlockWorkflow data={data as WorkflowFillEmailBlockResponse} onAction={onAction} />;
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
  data: WorkflowScheduleResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const ScheduleWorkflow = memo(function ScheduleWorkflow({ data, onAction }: ScheduleWorkflowProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to create schedule'}</p>
        </div>
      </Card>
    );
  }

  // Check if this is completed phase
  const isCompleted = data.phase === 'completed';

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-500/10">
            <Calendar className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Schedule {isCompleted ? 'Created' : 'Ready'}</h4>
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
        {data.blocks && data.blocks.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Your Schedule for {data.date}:</h5>
            {data.blocks.map((block, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {block.type}
                  </Badge>
                  <span className="text-sm font-medium">{block.title}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(block.startTime), 'h:mm a')} - {format(new Date(block.endTime), 'h:mm a')}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {/* Actions - only show for completed phase if adjustments are needed */}
        {isCompleted && data.conflicts && data.conflicts.length > 0 && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.({ 
                type: 'adjust_schedule', 
                payload: { date: data.date } 
              })}
            >
              Resolve Conflicts
            </Button>
          </div>
        )}
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
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to fill work block'}</p>
        </div>
      </Card>
    );
  }

  // Handle completed phase
  if (data.phase === 'completed') {
    return (
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Work Block Filled</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {data.summary}
              </p>
            </div>
          </div>
          
          {/* Show assigned tasks if available */}
          {data.assigned && data.assigned.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium mb-2">Assigned tasks:</p>
              <ul className="space-y-1">
                {data.assigned.map((taskId: string, idx: number) => (
                  <li key={idx} className="text-sm text-muted-foreground">
                    • Task {taskId}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={() => onAction?.({ 
                type: 'view_block', 
                payload: { blockId: data.blockId }
              })}
            >
              View Block
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.({ 
                type: 'adjust_tasks', 
                payload: { blockId: data.blockId }
              })}
            >
              Adjust Tasks
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  
  // Fallback for unknown phase
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-blue-500/10">
          <TrendingUp className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Fill Work Block</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {data.message || data.summary || 'Work block workflow in progress'}
          </p>
        </div>
      </div>
    </Card>
  );
});

// Fill email block workflow component
interface FillEmailBlockWorkflowProps {
  data: WorkflowFillEmailBlockResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const FillEmailBlockWorkflow = memo(function FillEmailBlockWorkflow({ data, onAction }: FillEmailBlockWorkflowProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to fill email block'}</p>
        </div>
      </Card>
    );
  }

  // Handle completed phase
  if (data.phase === 'completed') {
    return (
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-purple-500/10">
              <Mail className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Email Block Filled</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {data.summary}
              </p>
            </div>
          </div>
          
          {/* Show processed/archived counts if available */}
          {(data.processed !== undefined || data.archived !== undefined) && (
            <div className="flex gap-4 text-sm">
              {data.processed !== undefined && (
                <div className="flex items-center gap-1">
                  <Badge variant="outline">Processed</Badge>
                  <span>{data.processed}</span>
                </div>
              )}
              {data.archived !== undefined && (
                <div className="flex items-center gap-1">
                  <Badge variant="outline">Archived</Badge>
                  <span>{data.archived}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={() => onAction?.({ 
                type: 'view_emails', 
                payload: { blockId: data.blockId }
              })}
            >
              View Emails
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.({ 
                type: 'process_more', 
                payload: { blockId: data.blockId }
              })}
            >
              Process More
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  
  // Fallback for unknown phase
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-purple-500/10">
          <Mail className="h-4 w-4 text-purple-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Fill Email Block</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {data.message || data.summary || 'Email block workflow in progress'}
          </p>
        </div>
      </div>
    </Card>
  );
});

export default WorkflowDisplay; 