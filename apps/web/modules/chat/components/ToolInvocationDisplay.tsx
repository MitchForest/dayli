import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, CheckCircle2, XCircle, AlertCircle,
  Calendar, Mail, CheckSquare, Settings, Zap,
  BarChart3, Clock, Search, Archive, Users,
  FileText, Brain, Trash2
} from 'lucide-react';

interface ToolInvocationDisplayProps {
  toolName: string;
  state: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  isPartOfWorkflow?: boolean;
  workflowStep?: number;
  totalSteps?: number;
}

export const ToolInvocationDisplay = memo(function ToolInvocationDisplay({
  toolName,
  state,
  error,
  isPartOfWorkflow = false,
  workflowStep,
  totalSteps
}: ToolInvocationDisplayProps) {
  // Get icon and display name for tool
  const getToolInfo = (name: string): { icon: any; displayName: string; category: string } => {
    // Schedule tools
    if (name.includes('schedule_viewSchedule')) return { icon: Calendar, displayName: 'Viewing Schedule', category: 'schedule' };
    if (name.includes('schedule_createTimeBlock')) return { icon: Clock, displayName: 'Creating Time Block', category: 'schedule' };
    if (name.includes('schedule_moveTimeBlock')) return { icon: Clock, displayName: 'Moving Time Block', category: 'schedule' };
    if (name.includes('schedule_deleteTimeBlock')) return { icon: Trash2, displayName: 'Deleting Time Block', category: 'schedule' };
    if (name.includes('schedule_findGaps')) return { icon: Search, displayName: 'Finding Schedule Gaps', category: 'schedule' };
    if (name.includes('schedule_batchCreateBlocks')) return { icon: Clock, displayName: 'Creating Multiple Blocks', category: 'schedule' };
    if (name.includes('schedule_analyzeUtilization')) return { icon: BarChart3, displayName: 'Analyzing Schedule', category: 'schedule' };
    
    // Task tools
    if (name.includes('task_viewTasks')) return { icon: CheckSquare, displayName: 'Viewing Tasks', category: 'task' };
    if (name.includes('task_createTask')) return { icon: CheckSquare, displayName: 'Creating Task', category: 'task' };
    if (name.includes('task_updateTask')) return { icon: CheckSquare, displayName: 'Updating Task', category: 'task' };
    if (name.includes('task_completeTask')) return { icon: CheckCircle2, displayName: 'Completing Task', category: 'task' };
    if (name.includes('task_getBacklogWithScores')) return { icon: BarChart3, displayName: 'Scoring Task Backlog', category: 'task' };
    if (name.includes('task_assignToTimeBlock')) return { icon: Clock, displayName: 'Assigning Task to Block', category: 'task' };
    if (name.includes('task_suggestForDuration')) return { icon: Brain, displayName: 'Suggesting Tasks', category: 'task' };
    
    // Email tools
    if (name.includes('email_viewEmails')) return { icon: Mail, displayName: 'Viewing Emails', category: 'email' };
    if (name.includes('email_readEmail')) return { icon: Mail, displayName: 'Reading Email', category: 'email' };
    if (name.includes('email_processEmail')) return { icon: Mail, displayName: 'Processing Email', category: 'email' };
    if (name.includes('email_getBacklog')) return { icon: Mail, displayName: 'Getting Email Backlog', category: 'email' };
    if (name.includes('email_categorizeEmail')) return { icon: Mail, displayName: 'Categorizing Email', category: 'email' };
    if (name.includes('email_batchCategorize')) return { icon: Mail, displayName: 'Batch Categorizing', category: 'email' };
    if (name.includes('email_groupBySender')) return { icon: Users, displayName: 'Grouping by Sender', category: 'email' };
    if (name.includes('email_archiveBatch')) return { icon: Archive, displayName: 'Archiving Emails', category: 'email' };
    if (name.includes('email_createTaskFromEmail')) return { icon: CheckSquare, displayName: 'Creating Task from Email', category: 'email' };
    
    // Calendar tools
    if (name.includes('calendar_scheduleMeeting')) return { icon: Calendar, displayName: 'Scheduling Meeting', category: 'calendar' };
    if (name.includes('calendar_rescheduleMeeting')) return { icon: Calendar, displayName: 'Rescheduling Meeting', category: 'calendar' };
    
    // Preference tools
    if (name.includes('preference_updatePreferences')) return { icon: Settings, displayName: 'Updating Preferences', category: 'preference' };
    
    // System tools
    if (name.includes('system_confirmProposal')) return { icon: CheckCircle2, displayName: 'Confirming Proposal', category: 'system' };
    if (name.includes('system_showWorkflowHistory')) return { icon: Clock, displayName: 'Showing History', category: 'system' };
    if (name.includes('system_clearContext')) return { icon: Trash2, displayName: 'Clearing Context', category: 'system' };
    
    // Workflow tools
    if (name.includes('workflow_schedule')) return { icon: Calendar, displayName: 'Planning Schedule', category: 'workflow' };
    if (name.includes('workflow_fillWorkBlock')) return { icon: Zap, displayName: 'Filling Work Block', category: 'workflow' };
    if (name.includes('workflow_fillEmailBlock')) return { icon: Mail, displayName: 'Processing Email Block', category: 'workflow' };
    
    // Default
    return { icon: Zap, displayName: name.replace(/_/g, ' '), category: 'default' };
  };
  
  const { icon: Icon, displayName, category } = getToolInfo(toolName);
  
  const getStateIcon = () => {
    switch (state) {
      case 'pending':
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
    }
  };
  
  const getStateColor = () => {
    switch (state) {
      case 'pending':
        return 'text-muted-foreground';
      case 'running':
        return 'text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
    }
  };
  
  const getCategoryColor = () => {
    const colors: Record<string, string> = {
      schedule: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      task: 'bg-green-500/10 text-green-700 dark:text-green-300',
      email: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
      calendar: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
      workflow: 'bg-pink-500/10 text-pink-700 dark:text-pink-300',
      system: 'bg-gray-500/10 text-gray-700 dark:text-gray-300',
      preference: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
      default: 'bg-muted text-muted-foreground'
    };
    return colors[category] || colors.default;
  };
  
  if (isPartOfWorkflow && workflowStep && totalSteps) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-sm py-1",
        getStateColor()
      )}>
        <div className="flex items-center gap-1.5">
          {getStateIcon()}
          <span className="text-xs text-muted-foreground">
            Step {workflowStep}/{totalSteps}:
          </span>
          <Icon className="h-3.5 w-3.5" />
          <span>{displayName}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
      getCategoryColor(),
      state === 'failed' && 'bg-red-500/10'
    )}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium">{displayName}</span>
      {getStateIcon()}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400 ml-1">
          {error}
        </span>
      )}
    </div>
  );
});

export default ToolInvocationDisplay; 