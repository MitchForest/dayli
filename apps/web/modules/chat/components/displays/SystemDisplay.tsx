import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, XCircle, AlertCircle, Clock, 
  History, Play, MessageSquare, Brain, Trash2,
  TrendingUp, Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SystemDisplayProps {
  toolName: string;
  data: any;
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const SystemDisplay = memo(function SystemDisplay({ 
  toolName,
  data, 
  onAction 
}: SystemDisplayProps) {
  // Handle different system tool responses
  if (toolName === 'system_confirmProposal') {
    return <ProposalConfirmed data={data} onAction={onAction} />;
  }
  if (toolName === 'system_showWorkflowHistory') {
    return <WorkflowHistory data={data} onAction={onAction} />;
  }
  if (toolName === 'system_resumeWorkflow') {
    return <WorkflowResumed data={data} onAction={onAction} />;
  }
  if (toolName === 'system_provideFeedback') {
    return <FeedbackProvided data={data} onAction={onAction} />;
  }
  if (toolName === 'system_showPatterns') {
    return <PatternsDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'system_clearContext') {
    return <ContextCleared data={data} onAction={onAction} />;
  }
  
  // Fallback
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Proposal confirmed component
const ProposalConfirmed = memo(function ProposalConfirmed({ data }: any) {
  if (!data.executed) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-gray-500/10">
            <XCircle className="h-4 w-4 text-gray-600" />
          </div>
          <div>
            <h4 className="font-medium">Proposal Cancelled</h4>
            <p className="text-sm text-muted-foreground mt-1">
              The proposed changes were not applied.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Changes Applied Successfully</h4>
          
          {data.changes && data.changes.length > 0 && (
            <div className="mt-3 space-y-1">
              {data.changes.map((change: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`h-3 w-3 ${
                    change.result === 'success' ? 'text-green-600' : 'text-red-600'
                  }`} />
                  <span className={change.result === 'failed' ? 'line-through' : ''}>
                    {change.description}
                  </span>
                  {change.result === 'failed' && (
                    <Badge variant="destructive" className="text-xs">Failed</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

// Workflow history component
const WorkflowHistory = memo(function WorkflowHistory({ data, onAction }: any) {
  if (!data.workflows || data.workflows.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-gray-500/10">
            <History className="h-4 w-4 text-gray-600" />
          </div>
          <div>
            <h4 className="font-medium">No Workflow History</h4>
            <p className="text-sm text-muted-foreground mt-1">
              No workflows have been executed yet.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'text-green-600 bg-green-500/10',
      failed: 'text-red-600 bg-red-500/10',
      interrupted: 'text-yellow-600 bg-yellow-500/10',
    };
    return colors[status] || 'text-gray-600 bg-gray-500/10';
  };
  
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <History className="h-5 w-5 text-muted-foreground" />
          <h4 className="font-medium">Workflow History</h4>
          <Badge variant="secondary" className="ml-auto">
            {data.workflows.length} workflows
          </Badge>
        </div>
        
        <div className="space-y-2">
          {data.workflows.map((workflow: any) => (
            <div 
              key={workflow.id}
              className="p-3 bg-muted rounded-md cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => onAction?.({ 
                type: 'view_workflow', 
                payload: { workflowId: workflow.id } 
              })}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{workflow.type}</span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getStatusColor(workflow.status)}`}
                    >
                      {workflow.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(workflow.executedAt), { addSuffix: true })}
                    {workflow.changes && ` • ${workflow.changes} changes`}
                  </p>
                  {workflow.outcome && (
                    <p className="text-xs mt-1">{workflow.outcome}</p>
                  )}
                </div>
                {workflow.status === 'interrupted' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction?.({ 
                        type: 'resume_workflow', 
                        payload: { workflowId: workflow.id } 
                      });
                    }}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
});

// Workflow resumed component
const WorkflowResumed = memo(function WorkflowResumed({ data }: any) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
        </div>
        <div>
          <h4 className="font-medium">Workflow Resume Not Available</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {data.error || 'Workflow persistence will be available in a future update'}
          </p>
        </div>
      </div>
    </Card>
  );
});

// Feedback provided component
const FeedbackProvided = memo(function FeedbackProvided({ data }: any) {
  return (
    <Card className="p-4 bg-green-500/5 border-green-500/20">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-green-500/10">
          <MessageSquare className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <h4 className="font-medium">Thank You for Your Feedback!</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Your feedback has been recorded and will help improve the AI assistant.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Feedback ID: {data.feedbackId}
          </p>
        </div>
      </div>
    </Card>
  );
});

// Patterns display component
const PatternsDisplay = memo(function PatternsDisplay({ data }: any) {
  if (!data.patterns || data.patterns.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-gray-500/10">
            <Brain className="h-4 w-4 text-gray-600" />
          </div>
          <div>
            <h4 className="font-medium">No Patterns Detected Yet</h4>
            <p className="text-sm text-muted-foreground mt-1">
              As you use the system more, patterns will be identified and displayed here.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  
  // Group patterns by category
  const groupedPatterns = data.patterns.reduce((acc: any, pattern: any) => {
    if (!acc[pattern.category]) acc[pattern.category] = [];
    acc[pattern.category].push(pattern);
    return acc;
  }, {});
  
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-5 w-5 text-muted-foreground" />
          <h4 className="font-medium">Learned Patterns</h4>
          <Badge variant="secondary" className="ml-auto">
            {data.patterns.length} patterns
          </Badge>
        </div>
        
        <div className="space-y-3">
          {Object.entries(groupedPatterns).map(([category, patterns]: any) => (
            <div key={category}>
              <h5 className="text-sm font-medium mb-2 capitalize">{category}</h5>
              <div className="space-y-2">
                {patterns.map((pattern: any, idx: number) => (
                  <div key={idx} className="p-2 bg-muted rounded-md">
                    <div className="flex items-start justify-between">
                      <p className="text-sm">{pattern.pattern}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{Math.round(pattern.confidence * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    {pattern.examples && pattern.examples.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Examples: {pattern.examples.slice(0, 2).join(', ')}
                        {pattern.examples.length > 2 && ` +${pattern.examples.length - 2} more`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
});

// Context cleared component
const ContextCleared = memo(function ContextCleared({ data }: any) {
  return (
    <Card className="p-4 bg-blue-500/5 border-blue-500/20">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-blue-500/10">
          <Trash2 className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h4 className="font-medium">Context Cleared</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {data.scope === 'all' 
              ? 'All conversation context has been cleared. Starting fresh!'
              : 'Conversation context has been cleared.'}
          </p>
        </div>
      </div>
    </Card>
  );
});

export default SystemDisplay;