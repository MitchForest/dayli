import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, MailOpen, Paperclip, AlertCircle, Send, FileText, Archive, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { 
  EmailListResponse,
  ReadEmailResponse,
  ProcessEmailResponse
} from '@/modules/ai/tools/types/responses';

interface EmailDisplayProps {
  toolName: string;
  data: any; // Will be one of the email response types
  onAction?: (action: { type: string; payload?: any }) => void;
}

export const EmailDisplay = memo(function EmailDisplay({ 
  toolName,
  data, 
  onAction 
}: EmailDisplayProps) {
  // Handle different email tool responses
  if (toolName === 'email_viewEmails') {
    return <EmailList data={data as EmailListResponse} onAction={onAction} />;
  }
  if (toolName === 'email_readEmail') {
    return <EmailContent data={data as ReadEmailResponse} onAction={onAction} />;
  }
  if (toolName === 'email_processEmail') {
    return <EmailProcessed data={data as ProcessEmailResponse} onAction={onAction} />;
  }
  
  // Fallback
  return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
});

// Email list component
interface EmailListProps {
  data: EmailListResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const EmailList = memo(function EmailList({ data, onAction }: EmailListProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to load emails'}</p>
        </div>
      </Card>
    );
  }

  const getUrgencyColor = (urgency: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
      important: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
      normal: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30',
    };
    return colors[urgency] || colors.normal;
  };
  
  return (
    <div className="space-y-4">
      {/* Stats header */}
      {data.stats && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{data.stats.total} emails</span>
          </div>
          <div className="flex items-center gap-2">
            <MailOpen className="h-4 w-4 text-muted-foreground" />
            <span>{data.stats.unread} unread</span>
          </div>
          {data.stats.urgent > 0 && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{data.stats.urgent} urgent</span>
            </div>
          )}
        </div>
      )}
      
      {/* Email list */}
      <div className="space-y-2">
        {data.emails?.map((email) => (
          <Card
            key={email.id}
            className={`p-4 cursor-pointer transition-all hover:shadow-sm ${
              email.isRead ? 'opacity-75' : ''
            }`}
            onClick={() => onAction?.({ type: 'read_email', payload: { emailId: email.id } })}
          >
            <div className="flex items-start gap-3">
              <Mail className={`h-5 w-5 mt-0.5 ${
                email.isRead ? 'text-muted-foreground' : 'text-primary'
              }`} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium truncate ${
                        !email.isRead ? 'font-semibold' : ''
                      }`}>
                        {email.from}
                      </h4>
                      {email.urgency && email.urgency !== 'normal' && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getUrgencyColor(email.urgency)}`}
                        >
                          {email.urgency}
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${
                      !email.isRead ? 'font-medium' : 'text-muted-foreground'
                    }`}>
                      {email.subject}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {email.snippet}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                    </span>
                    {email.hasAttachments && (
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Empty state */}
      {(!data.emails || data.emails.length === 0) && (
        <Card className="p-8 text-center">
          <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">No emails found</p>
        </Card>
      )}
      
      {/* Quick actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction?.({ type: 'categorize_emails' })}
        >
          Categorize
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction?.({ type: 'group_by_sender' })}
        >
          Group by Sender
        </Button>
      </div>
    </div>
  );
});

// Email content component
interface EmailContentProps {
  data: ReadEmailResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const EmailContent = memo(function EmailContent({ data, onAction }: EmailContentProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to load email'}</p>
        </div>
      </Card>
    );
  }

  const email = data.email;
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">{email.subject}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>From: {email.from}</span>
                <span>•</span>
                <span>{email.fromEmail}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                To: {email.to}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(email.receivedAt).toLocaleString()}
            </span>
          </div>
        </div>
        
        {/* Body */}
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans">{email.body}</pre>
        </div>
        
        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Attachments</h4>
            <div className="space-y-1">
              {email.attachments.map((attachment, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <Paperclip className="h-3 w-3" />
                  <span>{attachment.filename}</span>
                  <span className="text-muted-foreground">
                    ({(attachment.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Extracted actions */}
        {email.extractedActions && email.extractedActions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Detected Action Items</h4>
            <div className="space-y-1">
              {email.extractedActions.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                  <span className="text-sm">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={() => onAction?.({ 
              type: 'draft_reply', 
              payload: { emailId: email.id } 
            })}
          >
            <Send className="h-4 w-4 mr-1" />
            Reply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction?.({ 
              type: 'create_task_from_email', 
              payload: { emailId: email.id } 
            })}
          >
            <FileText className="h-4 w-4 mr-1" />
            Create Task
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction?.({ 
              type: 'archive_email', 
              payload: { emailId: email.id } 
            })}
          >
            <Archive className="h-4 w-4 mr-1" />
            Archive
          </Button>
        </div>
      </div>
    </Card>
  );
});

// Email processed component
interface EmailProcessedProps {
  data: ProcessEmailResponse;
  onAction?: (action: { type: string; payload?: any }) => void;
}

const EmailProcessed = memo(function EmailProcessed({ data, onAction }: EmailProcessedProps) {
  // Handle error state
  if (!data.success) {
    return (
      <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{data.error || 'Failed to process email'}</p>
        </div>
      </Card>
    );
  }

  const getActionIcon = (action: string) => {
    const icons: Record<string, any> = {
      draft: Send,
      send: Send,
      convert_to_task: FileText,
      archive: Archive,
    };
    return icons[action] || Mail;
  };
  
  const getActionMessage = (action: string, result: any) => {
    switch (action) {
      case 'draft':
        return `Draft created and ready to send`;
      case 'send':
        return `Email sent successfully`;
      case 'convert_to_task':
        return `Task created: "${result.taskTitle}"`;
      default:
        return `Email processed`;
    }
  };
  
  const Icon = getActionIcon(data.action);
  
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-green-500/10">
          <Icon className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">Email Processed</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {getActionMessage(data.action, data.result)}
          </p>
          {data.result?.draftContent && (
            <div className="mt-3 p-3 bg-muted rounded-md">
              <p className="text-sm whitespace-pre-wrap">{data.result.draftContent}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

export default EmailDisplay;