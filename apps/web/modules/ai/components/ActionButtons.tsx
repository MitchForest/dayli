'use client';

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Action } from '../schemas/universal.schema';
import { 
  Calendar, 
  CheckSquare, 
  Mail, 
  Plus, 
  RefreshCw, 
  Settings,
  Trash2,
  Edit,
  Eye,
  Send,
  Archive,
  Clock,
  Users,
  FileText,
  Link2
} from 'lucide-react';

interface ActionButtonsProps {
  actions: Action[];
  onAction?: (action: Action | { type: 'message'; message: string }) => void;
  className?: string;
}

const iconMap: Record<string, any> = {
  calendar: Calendar,
  task: CheckSquare,
  email: Mail,
  plus: Plus,
  refresh: RefreshCw,
  settings: Settings,
  delete: Trash2,
  edit: Edit,
  view: Eye,
  send: Send,
  archive: Archive,
  time: Clock,
  users: Users,
  file: FileText,
  link: Link2,
};

export const ActionButtons = memo(function ActionButtons({
  actions,
  onAction,
  className,
}: ActionButtonsProps) {
  const handleAction = (action: Action) => {
    if (!onAction) return;
    
    switch (action.action.type) {
      case 'tool':
        // For tool actions, we'd need to invoke the tool
        // This would be handled by the parent component
        onAction(action);
        break;
        
      case 'message':
        // Send a message to the chat
        if (action.action.message) {
          onAction({ type: 'message', message: action.action.message });
        }
        break;
        
      case 'url':
        // Open URL in new tab
        if (action.action.url) {
          window.open(action.action.url, '_blank');
        }
        break;
    }
  };

  const getVariant = (variant: Action['variant']) => {
    switch (variant) {
      case 'primary':
        return 'default';
      case 'danger':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {actions.map((action) => {
        const Icon = action.icon ? iconMap[action.icon] : null;
        
        return (
          <Button
            key={action.id}
            variant={getVariant(action.variant)}
            size="sm"
            onClick={() => handleAction(action)}
            className="gap-2"
          >
            {Icon && <Icon className="h-3 w-3" />}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}); 