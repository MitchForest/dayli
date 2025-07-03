import { memo, lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

// Lazy load display components for better performance
const displays = {
  schedule: lazy(() => import('./displays/ScheduleDisplay')),
  task: lazy(() => import('./displays/TaskDisplay')),
  email: lazy(() => import('./displays/EmailDisplay')),
  calendar: lazy(() => import('./displays/CalendarDisplay')),
  preference: lazy(() => import('./displays/PreferenceDisplay')),
  workflow: lazy(() => import('./displays/WorkflowDisplay')),
  system: lazy(() => import('./displays/SystemDisplay')),
  default: lazy(() => import('./displays/DefaultDisplay')),
};

interface ToolResultRendererProps {
  toolName: string;
  result: any;
  isStreaming?: boolean;
  streamProgress?: number;
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const ToolResultRenderer = memo(function ToolResultRenderer({
  toolName,
  result,
  isStreaming,
  streamProgress,
  onAction,
}: ToolResultRendererProps) {
  // Extract category from tool name (e.g., "schedule_viewSchedule" -> "schedule")
  const getDisplayCategory = (): keyof typeof displays => {
    const parts = toolName.split('_');
    const category = parts[0];
    
    // Map category to display component
    if (category && category in displays) {
      return category as keyof typeof displays;
    }
    
    // Fallback detection based on tool name patterns
    if (toolName.includes('schedule') || toolName.includes('TimeBlock')) return 'schedule';
    if (toolName.includes('task')) return 'task';
    if (toolName.includes('email')) return 'email';
    if (toolName.includes('meeting') || toolName.includes('calendar')) return 'calendar';
    if (toolName.includes('preference')) return 'preference';
    if (toolName.includes('optimize') || toolName.includes('triage') || toolName.includes('prioritize')) return 'workflow';
    if (toolName.includes('confirm') || toolName.includes('show') || toolName.includes('clear') || toolName.includes('provide') || toolName.includes('resume')) return 'system';
    
    return 'default';
  };
  
  const displayCategory = getDisplayCategory();
  const Display = displays[displayCategory];
  
  // Show streaming progress if applicable
  if (isStreaming && streamProgress !== undefined && streamProgress < 100) {
    return (
      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {result?.stage || 'Processing...'}
          </span>
          <span className="text-sm text-muted-foreground">
            {streamProgress}%
          </span>
        </div>
        <Progress value={streamProgress} className="h-2" />
        {result?.partialResult && (
          <div className="mt-3 p-3 bg-background rounded-md border">
            <pre className="text-xs text-muted-foreground overflow-auto max-h-32">
              {JSON.stringify(result.partialResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }
  
  // Handle errors
  if (!result || (result.success === false && result.error)) {
    return (
      <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
        <p className="text-sm text-destructive">
          {result?.error || 'An error occurred while executing this tool.'}
        </p>
      </div>
    );
  }
  
  // Render the appropriate display component
  return (
    <Suspense 
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      }
    >
      <Display 
        toolName={toolName}
        data={result} 
        onAction={onAction} 
      />
    </Suspense>
  );
});

// Export for use in MessageList
export default ToolResultRenderer;