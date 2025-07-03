import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckSquare, Clock, TrendingUp, AlertCircle, 
  Target, Zap, BarChart3, ArrowRight
} from 'lucide-react';

interface TaskManagementDisplayProps {
  toolName: string;
  data: any;
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const TaskManagementDisplay = memo(function TaskManagementDisplay({ 
  toolName,
  data, 
  onAction 
}: TaskManagementDisplayProps) {
  // Handle different task management tools
  if (toolName === 'task_getBacklogWithScores') {
    return <BacklogWithScoresDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'task_assignToTimeBlock') {
    return <AssignToTimeBlockDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'task_suggestForDuration') {
    return <SuggestForDurationDisplay data={data} onAction={onAction} />;
  }
  
  // Fallback
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Backlog with scores display
const BacklogWithScoresDisplay = memo(function BacklogWithScoresDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to get task backlog'}</p>
        </div>
      </Card>
    );
  }

  const tasks = data.tasks || [];
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-500/10';
    if (score >= 60) return 'text-orange-600 bg-orange-500/10';
    if (score >= 40) return 'text-yellow-600 bg-yellow-500/10';
    return 'text-green-600 bg-green-500/10';
  };
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-purple-500/10">
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Task Backlog Analysis</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {tasks.length} tasks scored and prioritized
            </p>
          </div>
        </div>
        
        {tasks.length > 0 ? (
          <div className="space-y-2">
            {tasks.map((task: any) => (
              <div key={task.id} className="p-3 bg-muted rounded-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{task.title}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getScoreColor(task.score)}`}
                      >
                        Score: {task.score}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        <Clock className="inline h-3 w-3 mr-1" />
                        {task.estimatedMinutes} min
                      </span>
                      {task.scoreBreakdown && (
                        <>
                          <span>Priority: {task.scoreBreakdown.priority}</span>
                          <span>Age: {task.scoreBreakdown.age}</span>
                          <span>Urgency: {task.scoreBreakdown.urgency}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAction?.({ 
                      type: 'select_task', 
                      payload: { taskId: task.id } 
                    })}
                  >
                    Select
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <CheckSquare className="h-4 w-4" />
            <AlertDescription>
              No tasks in backlog matching criteria
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
});

// Assign to time block display
const AssignToTimeBlockDisplay = memo(function AssignToTimeBlockDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to assign tasks'}</p>
        </div>
      </Card>
    );
  }

  const assigned = data.assigned || [];
  const failed = data.failed || [];
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-500/10">
            <CheckSquare className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Task Assignment Complete</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {assigned.length} tasks assigned successfully
              {failed.length > 0 && ` • ${failed.length} failed`}
            </p>
          </div>
        </div>
        
        {assigned.length > 0 && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <CheckSquare className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Tasks have been assigned to the time block
            </AlertDescription>
          </Alert>
        )}
        
        {failed.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">Failed assignments:</div>
                {failed.map((failure: any, idx: number) => (
                  <div key={idx} className="text-xs">
                    Task {failure.taskId}: {failure.reason}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onAction?.({ type: 'view_block' })}
        >
          View Updated Block
        </Button>
      </div>
    </Card>
  );
});

// Suggest for duration display
const SuggestForDurationDisplay = memo(function SuggestForDurationDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to suggest tasks'}</p>
        </div>
      </Card>
    );
  }

  const suggestions = data.suggestions || [];
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-500/10">
            <Target className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Task Suggestions</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {suggestions.length} combinations found for your time slot
            </p>
          </div>
        </div>
        
        {suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((suggestion: any, idx: number) => (
              <div key={idx} className="p-3 border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Option {idx + 1}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {suggestion.totalMinutes} min • Score: {suggestion.totalScore}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={idx === 0 ? 'default' : 'outline'}
                    onClick={() => onAction?.({ 
                      type: 'select_combination', 
                      payload: { combination: suggestion.combination } 
                    })}
                  >
                    Select
                  </Button>
                </div>
                
                <div className="space-y-1">
                  {suggestion.combination.map((task: any, taskIdx: number) => (
                    <div key={taskIdx} className="flex items-center gap-2 text-sm">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span>{task.title}</span>
                      <span className="text-muted-foreground">({task.estimatedMinutes}m)</span>
                    </div>
                  ))}
                </div>
                
                {suggestion.reasoning && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Zap className="inline h-3 w-3 mr-1" />
                    {suggestion.reasoning}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No suitable task combinations found for this duration
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
});

export default TaskManagementDisplay;
