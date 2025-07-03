import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, TrendingUp, Mail, Calendar, CheckCircle2, 
  AlertCircle, Clock, ArrowRight, Sparkles, BarChart3 
} from 'lucide-react';

interface WorkflowDisplayProps {
  toolName: string;
  data: any;
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const WorkflowDisplay = memo(function WorkflowDisplay({ 
  toolName,
  data, 
  onAction 
}: WorkflowDisplayProps) {
  // Handle different workflow tool responses
  if (toolName === 'workflow_optimizeSchedule') {
    return <ScheduleOptimization data={data} onAction={onAction} />;
  }
  if (toolName === 'workflow_triageEmails') {
    return <EmailTriage data={data} onAction={onAction} />;
  }
  if (toolName === 'workflow_prioritizeTasks') {
    return <TaskPrioritization data={data} onAction={onAction} />;
  }
  if (toolName === 'workflow_optimizeCalendar') {
    return <CalendarOptimization data={data} onAction={onAction} />;
  }
  
  // Fallback
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Schedule optimization component
const ScheduleOptimization = memo(function ScheduleOptimization({ data, onAction }: any) {
  if (!data.changes || data.changes.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <h4 className="font-medium">Schedule Already Optimized</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Your schedule for {data.date} is already well-organized!
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
          <div className="p-2 rounded-full bg-blue-500/10">
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Schedule Optimization Proposal</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Found {data.changes.length} optimization opportunities for {data.date}
            </p>
          </div>
        </div>
        
        {/* Metrics improvement */}
        {data.metrics && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Utilization</span>
                <span className="text-sm font-medium">
                  {data.metrics.utilizationBefore}% → {data.metrics.utilizationAfter}%
                </span>
              </div>
              <Progress 
                value={data.metrics.utilizationAfter} 
                className="mt-2 h-2"
              />
            </Card>
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Focus Time</span>
                <span className="text-sm font-medium">
                  +{(data.metrics.focusTimeAfter - data.metrics.focusTimeBefore).toFixed(1)}h
                </span>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs text-green-600">Improved</span>
              </div>
            </Card>
          </div>
        )}
        
        {/* Proposed changes */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium">Proposed Changes:</h5>
          {data.changes.map((change: any, idx: number) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-muted rounded-md">
              <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm">{change.description}</p>
                {change.impact && (
                  <p className="text-xs text-muted-foreground mt-1">{change.impact}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        {data.proposalId && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={() => onAction?.({ 
                type: 'confirm_proposal', 
                payload: { proposalId: data.proposalId, confirmed: true } 
              })}
            >
              Apply All Changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.({ 
                type: 'view_details', 
                payload: { proposalId: data.proposalId } 
              })}
            >
              View Details
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
});

// Email triage component
const EmailTriage = memo(function EmailTriage({ data, onAction }: any) {
  if (!data.success || !data.emailBatches || data.emailBatches.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </div>
          <div>
            <h4 className="font-medium">Email Triage Not Available</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {data.error || 'Email management workflow will be available soon'}
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
          <div>
            <h4 className="font-medium">Email Triage Complete</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Organized {data.emailBatches.reduce((sum: number, batch: any) => sum + batch.emails.length, 0)} emails
            </p>
          </div>
        </div>
        
        {/* Email batches */}
        {data.emailBatches.map((batch: any, idx: number) => (
          <div key={idx} className="p-3 bg-muted rounded-md">
            <h5 className="font-medium text-sm mb-2">{batch.category}</h5>
            <div className="space-y-1">
              {batch.emails.slice(0, 3).map((email: any) => (
                <div key={email.id} className="text-sm">
                  <span className="font-medium">{email.from}:</span> {email.subject}
                  {email.suggestedAction && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {email.suggestedAction}
                    </Badge>
                  )}
                </div>
              ))}
              {batch.emails.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{batch.emails.length - 3} more emails
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});

// Task prioritization component
const TaskPrioritization = memo(function TaskPrioritization({ data, onAction }: any) {
  if (!data.success || !data.rankedTasks || data.rankedTasks.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </div>
          <div>
            <h4 className="font-medium">Task Prioritization Not Available</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {data.error || 'Task intelligence workflow will be available soon'}
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
            <h4 className="font-medium">Task Prioritization</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Top {data.rankedTasks.length} tasks based on your current context
            </p>
          </div>
        </div>
        
        {/* Insights */}
        {data.insights && (
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-2 text-center">
              <div className="text-lg font-bold">{data.insights.overdueCount}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-lg font-bold">{data.insights.highPriorityCount}</div>
              <div className="text-xs text-muted-foreground">High Priority</div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-lg font-bold">{data.insights.quickWinsCount}</div>
              <div className="text-xs text-muted-foreground">Quick Wins</div>
            </Card>
          </div>
        )}
        
        {/* Ranked tasks */}
        <div className="space-y-2">
          {data.rankedTasks.map((task: any, idx: number) => (
            <div key={task.id} className="flex items-start gap-3 p-2 bg-muted rounded-md">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{task.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    Score: {task.score}
                  </Badge>
                </div>
                {task.reason && (
                  <p className="text-xs text-muted-foreground mt-1">{task.reason}</p>
                )}
                {task.suggestedTimeBlock && (
                  <p className="text-xs mt-1">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Best time: {task.suggestedTimeBlock}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={() => onAction?.({ 
              type: 'schedule_top_task', 
              payload: { taskId: data.rankedTasks[0].id } 
            })}
          >
            Schedule Top Task
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction?.({ type: 'view_all_tasks' })}
          >
            View All Tasks
          </Button>
        </div>
      </div>
    </Card>
  );
});

// Calendar optimization component
const CalendarOptimization = memo(function CalendarOptimization({ data, onAction }: any) {
  if (!data.success || !data.suggestions || data.suggestions.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </div>
          <div>
            <h4 className="font-medium">Calendar Optimization Not Available</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {data.error || 'Calendar optimization workflow will be available soon'}
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
          <div className="p-2 rounded-full bg-orange-500/10">
            <Calendar className="h-4 w-4 text-orange-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Calendar Optimization</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Found {data.suggestions.length} optimization opportunities
            </p>
            {data.potentialTimeSaved > 0 && (
              <Badge variant="secondary" className="mt-2">
                Save {data.potentialTimeSaved} minutes
              </Badge>
            )}
          </div>
        </div>
        
        {/* Suggestions */}
        <div className="space-y-2">
          {data.suggestions.map((suggestion: any, idx: number) => (
            <div key={idx} className="p-3 bg-muted rounded-md">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs">
                  {suggestion.type}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm">{suggestion.reason}</p>
                  {suggestion.impact && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Impact: {suggestion.impact}
                    </p>
                  )}
                  {suggestion.meetings && suggestion.meetings.length > 0 && (
                    <p className="text-xs mt-1">
                      Affects: {suggestion.meetings.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        {data.proposalId && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={() => onAction?.({ 
                type: 'confirm_proposal', 
                payload: { proposalId: data.proposalId, confirmed: true } 
              })}
            >
              Apply Optimizations
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction?.({ type: 'view_calendar' })}
            >
              View Calendar
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
});

export default WorkflowDisplay;