'use client';

import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  Mail, 
  Calendar,
  CheckSquare,
  AlertCircle,
  ChevronRight,
  Paperclip,
  Users,
  MapPin,
  Video,
  Star,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AICardProps {
  type: 'task' | 'email' | 'meeting' | 'generic';
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  metadata?: Array<{
    icon?: React.ReactNode;
    text: string;
    highlight?: boolean;
  }>;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  actions?: Array<{
    label: string;
    onClick: () => void | Promise<void>;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
  }>;
  className?: string;
  data?: any; // Type-specific data
}

export const AICard = memo(function AICard({
  type,
  title,
  subtitle,
  icon,
  badge,
  metadata = [],
  description,
  priority,
  actions = [],
  className,
  data
}: AICardProps) {
  const [loadingActionIndex, setLoadingActionIndex] = useState<number | null>(null);

  // Get type-specific styling and icons
  const getTypeConfig = () => {
    switch (type) {
      case 'task':
        return {
          icon: icon || <CheckSquare className="h-4 w-4" />,
          borderColor: priority === 'high' ? 'border-red-500/50' : 
                       priority === 'low' ? 'border-green-500/50' : 
                       'border-yellow-500/50',
          bgColor: priority === 'high' ? 'bg-red-50/50 dark:bg-red-950/20' : 
                   priority === 'low' ? 'bg-green-50/50 dark:bg-green-950/20' : 
                   'bg-yellow-50/50 dark:bg-yellow-950/20',
        };
      case 'email':
        return {
          icon: icon || <Mail className="h-4 w-4" />,
          borderColor: data?.urgency === 'urgent' ? 'border-red-500/50' : 'border-purple-500/50',
          bgColor: data?.urgency === 'urgent' ? 'bg-red-50/50 dark:bg-red-950/20' : 'bg-purple-50/50 dark:bg-purple-950/20',
        };
      case 'meeting':
        return {
          icon: icon || <Calendar className="h-4 w-4" />,
          borderColor: 'border-blue-500/50',
          bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
        };
      default:
        return {
          icon: icon,
          borderColor: 'border-border',
          bgColor: 'bg-card',
        };
    }
  };

  const config = getTypeConfig();

  // Build metadata items based on type
  const buildMetadata = () => {
    const items = [...metadata];
    
    if (type === 'task' && data) {
      if (data.estimatedMinutes) {
        items.unshift({
          icon: <Clock className="h-3 w-3" />,
          text: `${data.estimatedMinutes} min`,
        });
      }
      if (data.score !== undefined) {
        items.push({
          icon: <Star className="h-3 w-3" />,
          text: `Score: ${data.score}`,
          highlight: true,
        });
      }
    }
    
    if (type === 'email' && data) {
      if (data.hasAttachments) {
        items.push({
          icon: <Paperclip className="h-3 w-3" />,
          text: 'Attachments',
        });
      }
      if (!data.isRead) {
        items.unshift({
          text: 'Unread',
          highlight: true,
        });
      }
    }
    
    if (type === 'meeting' && data) {
      if (data.attendees?.length) {
        items.push({
          icon: <Users className="h-3 w-3" />,
          text: `${data.attendees.length} attendees`,
        });
      }
      if (data.location) {
        items.push({
          icon: data.meetingUrl ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />,
          text: data.location,
        });
      }
    }
    
    return items;
  };

  const displayMetadata = buildMetadata();

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-all hover:shadow-sm",
      config.borderColor,
      config.bgColor,
      className
    )}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {config.icon && (
                <span className="text-muted-foreground">{config.icon}</span>
              )}
              <h4 className="font-medium text-sm truncate">{title}</h4>
              {badge && (
                <Badge variant={badge.variant || 'secondary'} className="text-xs">
                  {badge.text}
                </Badge>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {priority && type === 'task' && (
            <Badge 
              variant={priority === 'high' ? 'destructive' : priority === 'low' ? 'outline' : 'secondary'}
              className="text-xs"
            >
              {priority}
            </Badge>
          )}
        </div>

        {/* Metadata */}
        {displayMetadata.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {displayMetadata.map((item, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "flex items-center gap-1",
                  item.highlight && "font-medium text-foreground"
                )}
              >
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            {actions.map((action, idx) => (
              <Button
                key={idx}
                size="sm"
                variant={action.variant || (idx === 0 ? 'default' : 'secondary')}
                onClick={async () => {
                  setLoadingActionIndex(idx);
                  try {
                    await action.onClick();
                  } finally {
                    setLoadingActionIndex(null);
                  }
                }}
                className="text-xs h-7"
                disabled={loadingActionIndex === idx}
              >
                {loadingActionIndex === idx && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}); 