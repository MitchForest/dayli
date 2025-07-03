import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Clock, Flag, AlertCircle, Calendar, TrendingUp } from 'lucide-react';

interface TaskDisplayProps {
  toolName: string;
  data: any;
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const TaskDisplay = memo(function TaskDisplay({ 
  toolName,
  data, 
  onAction 
}: TaskDisplayProps) {
  // Handle different task tool responses
  if (toolName === 'task_viewTasks') {
    return <TaskList data={data} onAction={onAction} />;
  }
  if (toolName === 'task_createTask') {
    return <TaskCreated data={data} onAction={onAction} />;
  }
  if (toolName === 'task_updateTask') {
    return <TaskUpdated data={data} onAction={onAction} />;
  }
  if (toolName === 'task_completeTask') {
    return <TaskCompleted data={data} onAction={onAction} />;
  }
  
  // Fallback
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Task list component
const TaskList = memo(function TaskList({ data, onAction }: any) {
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
      medium: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
      low: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    };
    return colors[priority] || colors.medium;
  };
  
  const getStatusIcon = (status: string) => {
    if (status === 'completed') return CheckCircle2;
    return Circle;
  };
  
  return (
    <div className="space-y-4">
      {/* Stats header */}
      {data.stats && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-2xl font-bold">{data.stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Tasks</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold">{data.stats.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold">{data.stats.highPriority}</div>
            <div className="text-sm text-muted-foreground">High Priority</div>
          </Card>
          <Card className="p-3">
            <div className="text-2xl font-bold">{data.stats.totalEstimatedHours.toFixed(1)}h</div>
            <div className="text-sm text-muted-foreground">Total Time</div>
          </Card>
        </div>
      )}
      
      {/* Task list */}
      <div className="space-y-2">
        {data.tasks.map((task: any) => {
          const StatusIcon = getStatusIcon(task.status);
          const isCompleted = task.status === 'completed';
          
          return (
            <Card
              key={task.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-sm ${
                isCompleted ? 'opacity-60' : ''
              }`}
              onClick={() => onAction?.({ type: 'view_task', payload: { taskId: task.id } })}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction?.({ 
                      type: isCompleted ? 'uncomplete_task' : 'complete_task', 
                      payload: { taskId: task.id } 
                    });
                  }}
                  className="mt-0.5"
                >
                  <StatusIcon className={`h-5 w-5 ${
                    isCompleted ? 'text-green-600' : 'text-muted-foreground hover:text-primary'
                  }`} />
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`font-medium ${isCompleted ? 'line-through' : ''}`}>
                      {task.title}
                    </h4>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge 
                        variant="outline" 
                        className={getPriorityColor(task.priority)}
                      >
                        <Flag className="h-3 w-3 mr-1" />
                        {task.priority}
                      </Badge>
                      {task.score && (
                        <Badge variant="secondary" className="text-xs">
                          Score: {task.score}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {task.estimatedMinutes && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.estimatedMinutes} min
                      </div>
                    )}
                    {task.dueDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    )}
                    {task.daysInBacklog && task.daysInBacklog > 3 && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <AlertCircle className="h-3 w-3" />
                        {task.daysInBacklog} days in backlog
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      
      {/* Empty state */}
      {data.tasks.length === 0 && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-3">No tasks found</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction?.({ type: 'create_task' })}
          >
            Create Task
          </Button>
        </Card>
      )}
      
      {/* Quick actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction?.({ type: 'create_task' })}
        >
          Add Task
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction?.({ type: 'prioritize_tasks' })}
        >
          <TrendingUp className="h-4 w-4 mr-1" />
          Prioritize
        </Button>
      </div>
    </div>
  );
});

// Task created component
const TaskCreated = memo(function TaskCreated({ data }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Task Created</h4>
          <p className="text-sm text-muted-foreground mt-1">
            "{data.task.title}" added to your task list
          </p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className="text-xs">
              {data.task.priority} priority
            </Badge>
            {data.task.estimatedMinutes && (
              <span className="text-xs text-muted-foreground">
                {data.task.estimatedMinutes} minutes
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});

// Task updated component
const TaskUpdated = memo(function TaskUpdated({ data }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-blue-500/10">
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Task Updated</h4>
          <p className="text-sm text-muted-foreground mt-1">
            "{data.task.title}" has been updated
          </p>
          {data.task.updatedFields && data.task.updatedFields.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                Changed: {data.task.updatedFields.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

// Task completed component
const TaskCompleted = memo(function TaskCompleted({ data }: any) {
  return (
    <Card className="p-4 bg-green-500/5 border-green-500/20">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Task Completed! 🎉</h4>
          <p className="text-sm text-muted-foreground mt-1">
            "{data.title}" marked as complete
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Completed at {new Date(data.completedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </Card>
  );
});

export default TaskDisplay;