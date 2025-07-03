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
  system: lazy(() => import('./displays/SystemDisplay')),
  default: lazy(() => import('./displays/DefaultDisplay')),
  // New displays for Sprint 4.3
  scheduleAnalysis: lazy(() => import('./displays/ScheduleAnalysisDisplay')),
  taskManagement: lazy(() => import('./displays/TaskManagementDisplay')),
  emailManagement: lazy(() => import('./displays/EmailManagementDisplay')),
  proposal: lazy(() => import('./displays/ProposalDisplay')),
  workflow: lazy(() => import('./displays/WorkflowDisplay')),
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
  // Use tool name to determine display type
  const getDisplayType = (): keyof typeof displays => {
    // Check if this is a workflow (proposal or completed)
    if (toolName.includes('workflow_')) {
      // If it's a proposal phase, use proposal display
      if (result?.phase === 'proposal' && result?.requiresConfirmation) {
        return 'proposal';
      }
      // Otherwise use workflow display (for completed or other phases)
      return 'workflow';
    }
    
    // New atomic tools from Sprint 4.3 - Schedule Analysis
    if (toolName.includes('schedule_findGaps') || 
        toolName.includes('schedule_batchCreateBlocks') || 
        toolName.includes('schedule_analyzeUtilization')) {
      return 'scheduleAnalysis';
    }
    
    // Task Management tools
    if (toolName.includes('task_getBacklogWithScores') || 
        toolName.includes('task_assignToTimeBlock') || 
        toolName.includes('task_suggestForDuration')) {
      return 'taskManagement';
    }
    
    // Email Management tools - be careful with the order here
    if (toolName.includes('email_getBacklog') || 
        toolName.includes('email_categorizeEmail') || 
        toolName.includes('email_batchCategorize') || 
        toolName.includes('email_groupBySender') || 
        toolName.includes('email_archiveBatch') || 
        toolName.includes('email_createTaskFromEmail')) {
      return 'emailManagement';
    }
    
    // Existing tools - check full tool names to avoid conflicts
    if (toolName.startsWith('schedule_')) return 'schedule';
    if (toolName.startsWith('task_')) return 'task';
    if (toolName.startsWith('email_')) return 'email';
    if (toolName.startsWith('calendar_')) return 'calendar';
    if (toolName.startsWith('preference_')) return 'preference';
    if (toolName.startsWith('system_')) return 'system';
    
    // Default fallback
    return 'default';
  };
  
  const displayType = getDisplayType();
  const Display = displays[displayType];
  
  // Show streaming progress if applicable
  if (isStreaming && streamProgress !== undefined && streamProgress < 100) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {result?.stage || 'Processing...'}
          </span>
          <span className="text-muted-foreground">{streamProgress}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${streamProgress}%` }}
          />
        </div>
        {result?.partialResult && (
          <div className="mt-2 p-2 bg-muted rounded-md">
            <pre className="text-xs">{JSON.stringify(result.partialResult, null, 2)}</pre>
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
    <Suspense fallback={<Skeleton className="h-32 w-full" />}>
      <Display toolName={toolName} data={result} onAction={onAction} />
    </Suspense>
  );
});

// Export for use in MessageList
export default ToolResultRenderer;