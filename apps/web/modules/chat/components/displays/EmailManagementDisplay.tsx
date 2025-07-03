import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Mail, Archive, Users, Tag, CheckCircle2, 
  AlertCircle, Clock, ArrowRight, Inbox
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface EmailManagementDisplayProps {
  toolName: string;
  data: any;
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const EmailManagementDisplay = memo(function EmailManagementDisplay({ 
  toolName,
  data, 
  onAction 
}: EmailManagementDisplayProps) {
  // Handle different email management tools
  if (toolName === 'email_getBacklog') {
    return <EmailBacklogDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'email_categorizeEmail') {
    return <CategorizeEmailDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'email_batchCategorize') {
    return <BatchCategorizeDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'email_groupBySender') {
    return <GroupBySenderDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'email_archiveBatch') {
    return <ArchiveBatchDisplay data={data} onAction={onAction} />;
  }
  if (toolName === 'email_createTaskFromEmail') {
    return <CreateTaskFromEmailDisplay data={data} onAction={onAction} />;
  }
  
  // Fallback
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Email backlog display
const EmailBacklogDisplay = memo(function EmailBacklogDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to get email backlog'}</p>
        </div>
      </Card>
    );
  }

  const emails = data.emails || [];
  const total = data.total || emails.length;
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-purple-500/10">
            <Inbox className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Email Backlog</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {total} emails need attention
            </p>
          </div>
        </div>
        
        {emails.length > 0 ? (
          <div className="space-y-2">
            {emails.slice(0, 10).map((email: any) => (
              <div key={email.id} className="p-3 bg-muted rounded-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{email.from}</span>
                      <Badge variant={email.status === 'unread' ? 'default' : 'secondary'} className="text-xs">
                        {email.status}
                      </Badge>
                      {email.hasAttachments && (
                        <Badge variant="outline" className="text-xs">
                          📎
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{email.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAction?.({ 
                      type: 'process_email', 
                      payload: { emailId: email.id } 
                    })}
                  >
                    Process
                  </Button>
                </div>
              </div>
            ))}
            {total > 10 && (
              <p className="text-xs text-muted-foreground text-center">
                +{total - 10} more emails
              </p>
            )}
          </div>
        ) : (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              No emails in backlog - inbox is clear!
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
});

// Categorize single email display
const CategorizeEmailDisplay = memo(function CategorizeEmailDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to categorize email'}</p>
        </div>
      </Card>
    );
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'needs_reply': 'text-red-600 bg-red-500/10',
      'important_info': 'text-blue-600 bg-blue-500/10',
      'potential_task': 'text-purple-600 bg-purple-500/10',
      'can_archive': 'text-green-600 bg-green-500/10',
    };
    return colors[category] || 'text-gray-600 bg-gray-500/10';
  };
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-500/10">
            <Tag className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Email Categorized</h4>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={getCategoryColor(data.category)}>
                {data.category.replace(/_/g, ' ')}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Confidence: {Math.round(data.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
        
        {data.suggestedAction && (
          <Alert>
            <ArrowRight className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Suggested action:</span> {data.suggestedAction}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onAction?.({ 
              type: 'apply_suggestion', 
              payload: { category: data.category } 
            })}
          >
            Apply Suggestion
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.({ type: 'view_email' })}
          >
            View Email
          </Button>
        </div>
      </div>
    </Card>
  );
});

// Batch categorize display
const BatchCategorizeDisplay = memo(function BatchCategorizeDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to categorize emails'}</p>
        </div>
      </Card>
    );
  }

  const categorized = data.categorized || [];
  const categoryGroups = categorized.reduce((acc: any, email: any) => {
    if (!acc[email.category]) acc[email.category] = [];
    acc[email.category].push(email);
    return acc;
  }, {});
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-purple-500/10">
            <Tag className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Batch Categorization Complete</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {categorized.length} emails categorized
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          {Object.entries(categoryGroups).map(([category, emails]: any) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium capitalize">
                  {category.replace(/_/g, ' ')}
                </h5>
                <Badge variant="secondary" className="text-xs">
                  {emails.length} emails
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {emails.slice(0, 4).map((email: any) => (
                  <div key={email.emailId} className="text-xs p-2 bg-muted rounded">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{email.emailId}</span>
                      <Badge variant="outline" className="text-xs">
                        {email.urgencyScore}
                      </Badge>
                    </div>
                  </div>
                ))}
                {emails.length > 4 && (
                  <div className="text-xs p-2 text-muted-foreground">
                    +{emails.length - 4} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <Button
          size="sm"
          className="w-full"
          onClick={() => onAction?.({ type: 'process_categorized' })}
        >
          Process by Category
        </Button>
      </div>
    </Card>
  );
});

// Group by sender display
const GroupBySenderDisplay = memo(function GroupBySenderDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to group emails'}</p>
        </div>
      </Card>
    );
  }

  const groups = data.groups || [];
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-500/10">
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Emails Grouped by Sender</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {groups.length} sender groups found
            </p>
          </div>
        </div>
        
        {groups.length > 0 ? (
          <div className="space-y-2">
            {groups.map((group: any, idx: number) => (
              <div key={idx} className="p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{group.sender}</span>
                    <Badge variant="secondary" className="text-xs">
                      {group.count} emails
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAction?.({ 
                      type: 'batch_process_sender', 
                      payload: { sender: group.sender, emailIds: group.emailIds } 
                    })}
                  >
                    Batch Process
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Email IDs: {group.emailIds.slice(0, 3).join(', ')}
                  {group.emailIds.length > 3 && ` +${group.emailIds.length - 3} more`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No sender groups found with minimum size
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
});

// Archive batch display
const ArchiveBatchDisplay = memo(function ArchiveBatchDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to archive emails'}</p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-500/10">
            <Archive className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Batch Archive Complete</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {data.archived} emails archived successfully
              {data.failed?.length > 0 && ` • ${data.failed.length} failed`}
            </p>
          </div>
        </div>
        
        <Progress value={(data.archived / (data.archived + (data.failed?.length || 0))) * 100} />
        
        {data.failed && data.failed.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">Failed to archive:</div>
                {data.failed.slice(0, 5).map((id: string) => (
                  <div key={id} className="text-xs">{id}</div>
                ))}
                {data.failed.length > 5 && (
                  <div className="text-xs">+{data.failed.length - 5} more</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onAction?.({ type: 'view_inbox' })}
        >
          <Mail className="h-4 w-4 mr-2" />
          View Updated Inbox
        </Button>
      </div>
    </Card>
  );
});

// Create task from email display
const CreateTaskFromEmailDisplay = memo(function CreateTaskFromEmailDisplay({ data, onAction }: any) {
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to create task'}</p>
        </div>
      </Card>
    );
  }

  const task = data.task;
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Task Created from Email</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Email converted to actionable task
            </p>
          </div>
        </div>
        
        <div className="p-3 bg-muted rounded-md">
          <h5 className="font-medium text-sm mb-2">{task.title}</h5>
          {task.description && (
            <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              <Clock className="inline h-3 w-3 mr-1" />
              {task.estimatedMinutes} minutes
            </span>
            <Badge variant="outline" className="text-xs">
              From Email
            </Badge>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onAction?.({ 
              type: 'view_task', 
              payload: { taskId: task.id } 
            })}
          >
            View Task
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.({ 
              type: 'archive_email', 
              payload: { emailId: data.emailId } 
            })}
          >
            Archive Email
          </Button>
        </div>
      </div>
    </Card>
  );
});

export default EmailManagementDisplay;
