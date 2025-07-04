import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, XCircle, Edit2, ArrowRight, 
  Calendar, Clock, Mail, Briefcase, Coffee,
  AlertCircle, Sparkles, BarChart3
} from 'lucide-react';
import { parse, differenceInMinutes } from 'date-fns';

interface ProposalDisplayProps {
  toolName: string;
  data: {
    success: boolean;
    error?: string;
    phase: 'proposal' | 'completed';
    requiresConfirmation: boolean;
    proposalId?: string;
    proposals?: any;
    changes?: any[];
    message?: string;
    summary?: string;
    // Workflow-specific fields
    date?: string;
    blocks?: any[];
    blockId?: string;
    blockTitle?: string;
    tasks?: any[];
    urgent?: any[];
    batched?: any[];
    toArchive?: string[];
    stats?: any;
    processed?: number;
    archived?: number;
  };
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const ProposalDisplay = memo(function ProposalDisplay({ 
  toolName,
  data, 
  onAction 
}: ProposalDisplayProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to generate proposal'}</p>
        </div>
      </Card>
    );
  }

  // Determine workflow type from tool name
  const workflowType = toolName.includes('schedule') ? 'schedule' :
                      toolName.includes('fillWorkBlock') ? 'tasks' :
                      toolName.includes('fillEmailBlock') ? 'emails' : 'unknown';

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header with phase indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-500/10">
              <Sparkles className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium">Proposal Ready</h4>
              <p className="text-sm text-muted-foreground">
                {data.message || 'Review the proposed changes below'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            Requires Confirmation
          </Badge>
        </div>

        {/* Workflow phase progress */}
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            1. Analysis
          </Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            2. Review
          </Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="secondary" className="gap-1">
            3. Execute
          </Badge>
        </div>

        {/* Render proposals based on workflow type */}
        {workflowType === 'schedule' && (data.blocks || data.proposals) && (
          <ScheduleProposal data={data} />
        )}
        
        {workflowType === 'tasks' && data.proposals && (
          <TaskProposal data={data} />
        )}
        
        {workflowType === 'emails' && data.proposals && (
          <EmailProposal data={data} />
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={() => onAction?.({ 
              type: 'approve_proposal', 
              payload: { 
                workflowType,
                proposalId: data.proposalId || (data as any).proposalId || data.proposals?.id,
                date: data.date,
                blockId: data.blockId
              } 
            })}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction?.({ 
              type: 'modify_proposal', 
              payload: { 
                workflowType,
                proposalId: data.proposalId || (data as any).proposalId || data.proposals?.id
              } 
            })}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Modify
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction?.({ 
              type: 'cancel_proposal', 
              payload: { workflowType } 
            })}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
});

// Schedule proposal sub-component
const ScheduleProposal = memo(function ScheduleProposal({ data }: { data: any }) {
  const getBlockIcon = (type: string) => {
    const icons: Record<string, any> = {
      work: Briefcase,
      meeting: Calendar,
      email: Mail,
      break: Coffee,
      blocked: XCircle,
    };
    return icons[type] || Clock;
  };

  const getBlockColor = (type: string) => {
    const colors: Record<string, string> = {
      work: 'bg-blue-100 border-blue-300 dark:bg-blue-950 dark:border-blue-800',
      meeting: 'bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-800',
      email: 'bg-purple-100 border-purple-300 dark:bg-purple-950 dark:border-purple-800',
      break: 'bg-green-100 border-green-300 dark:bg-green-950 dark:border-green-800',
      blocked: 'bg-gray-100 border-gray-300 dark:bg-gray-950 dark:border-gray-800',
    };
    return colors[type] || 'bg-gray-100 border-gray-300';
  };

  const calculateDuration = (startTime: string, endTime: string): number | null => {
    try {
      const start = parse(startTime, 'HH:mm', new Date());
      const end = parse(endTime, 'HH:mm', new Date());
      return differenceInMinutes(end, start);
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Proposed Schedule for {data.date}:</div>
      
      {/* Show proposed blocks - schedule workflow returns blocks directly, not under proposals */}
      {data.blocks && data.blocks.length > 0 ? (
        <div className="space-y-2">
          {data.blocks.map((block: any, idx: number) => {
            const Icon = getBlockIcon(block.type);
            const duration = block.duration || calculateDuration(block.startTime, block.endTime);
            return (
              <div 
                key={block.id || idx} 
                className={`p-3 rounded-md border ${getBlockColor(block.type)}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{block.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {block.startTime} - {block.endTime}
                        {duration && ` (${duration} min)`}
                      </span>
                    </div>
                    {block.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {block.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          No blocks to display
        </div>
      )}

      {/* Show summary and utilization */}
      {data.summary && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-md">
          <div className="text-sm">
            <p className="font-medium">{data.summary}</p>
            {(data as any).utilizationBefore !== undefined && (data as any).utilizationAfter !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Schedule utilization: {(data as any).utilizationBefore}% → {(data as any).utilizationAfter}%
              </p>
            )}
          </div>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Show changes if any */}
      {data.changes && data.changes.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium text-sm">Why these blocks?</div>
              {data.changes.map((change: any, idx: number) => (
                <div key={idx} className="text-xs flex items-start gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5" />
                  <div>
                    <span className="font-medium">{change.block}:</span>{' '}
                    {change.reason}
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});

// Task proposal sub-component
const TaskProposal = memo(function TaskProposal({ data }: { data: any }) {
  const proposal = data.proposals;
  
  return (
    <div className="space-y-3">
      <div className="text-sm">
        <span className="font-medium">Tasks for {data.blockTitle}</span>
        {proposal?.totalMinutes && (
          <span className="text-muted-foreground ml-2">
            ({proposal.totalMinutes} minutes total)
          </span>
        )}
      </div>
      
      {/* Show proposed tasks */}
      {proposal?.combination ? (
        <div className="space-y-2">
          {proposal.combination.map((task: any, idx: number) => (
            <div key={task.id || idx} className="flex items-start gap-3 p-2 bg-muted rounded-md">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{task.title}</span>
                  <Badge 
                    variant={task.priority === 'high' ? 'destructive' : 
                            task.priority === 'medium' ? 'default' : 'secondary'} 
                    className="text-xs"
                  >
                    {task.priority}
                  </Badge>
                  {task.score !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      Score: {task.score}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-muted-foreground">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {task.estimatedMinutes} min
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : proposal?.tasks ? (
        // Fallback to tasks array
        <div className="space-y-2">
          {proposal.tasks.map((task: any, idx: number) => (
            <div key={task.id} className="flex items-start gap-3 p-2 bg-muted rounded-md">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium">
                {idx + 1}
              </div>
              <div className="flex-1">
                <span className="font-medium text-sm">{task.title}</span>
                {task.estimatedMinutes && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {task.estimatedMinutes} min
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Show reasoning if available */}
      {proposal?.reasoning && (
        <Alert>
          <BarChart3 className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {proposal.reasoning}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});

// Email proposal sub-component
const EmailProposal = memo(function EmailProposal({ data }: { data: any }) {
  const proposals = data.proposals;
  
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Email Triage Plan:</div>
      
      {/* Urgent emails */}
      {proposals?.urgent && proposals.urgent.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="font-medium">Urgent Emails ({proposals.urgent.length})</span>
          </div>
          {proposals.urgent.slice(0, 3).map((email: any) => (
            <div key={email.emailId} className="p-2 bg-red-50 dark:bg-red-950 rounded-md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">{email.from || 'Unknown Sender'}</p>
                  <p className="text-xs text-muted-foreground">{email.subject || email.emailId}</p>
                </div>
                <Badge variant="destructive" className="text-xs ml-2">
                  Score: {email.urgencyScore}
                </Badge>
              </div>
            </div>
          ))}
          {proposals.urgent.length > 3 && (
            <p className="text-xs text-muted-foreground pl-6">
              +{proposals.urgent.length - 3} more urgent emails
            </p>
          )}
        </div>
      )}
      
      {/* Batched emails */}
      {proposals?.batched && proposals.batched.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Batch Process by Sender:</div>
          {proposals.batched.map((batch: any, idx: number) => (
            <div key={idx} className="p-2 bg-muted rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-sm">{batch.sender}</span>
                <Badge variant="secondary" className="text-xs">
                  {batch.count} emails
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Archive summary */}
      {proposals?.toArchive && proposals.toArchive.length > 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {proposals.toArchive.length} emails will be automatically archived
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});

export default ProposalDisplay;
