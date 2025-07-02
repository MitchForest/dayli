'use client';

import { cn } from '@/lib/utils';
import { 
  Calendar, 
  Mail, 
  CheckSquare, 
  Clock, 
  Settings,
  Workflow,
  Search,
  FileText,
  Zap,
  Command
} from 'lucide-react';

interface Command {
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  commands: {
    title: string;
    description: string;
    examples: string[];
  }[];
}

const allCommands: Command[] = [
  {
    category: 'Schedule & Time Management',
    icon: Calendar,
    commands: [
      {
        title: 'Plan My Day',
        description: 'Create an intelligent schedule based on your tasks and preferences',
        examples: ['Plan my day', 'What should I work on today?', 'Schedule my tasks']
      },
      {
        title: 'Create Time Block',
        description: 'Add a new time block to your schedule',
        examples: ['Block 2pm-4pm for deep work', 'Schedule email time at 10am', 'Add a meeting from 3-4pm']
      },
      {
        title: 'Move Time Block',
        description: 'Reschedule an existing time block',
        examples: ['Move my 2pm block to 4pm', 'Reschedule the design review']
      }
    ]
  },
  {
    category: 'Email Management',
    icon: Mail,
    commands: [
      {
        title: 'Triage Emails',
        description: 'Process and categorize your unread emails by importance and urgency',
        examples: ['Check my emails', 'What emails need attention?', 'Show me urgent emails']
      },
      {
        title: 'Draft Response',
        description: 'Generate an intelligent email response',
        examples: ['Draft a response to the latest email', 'Reply to John about the proposal']
      },
      {
        title: 'Process Email to Task',
        description: 'Convert an email into an actionable task',
        examples: ['Turn this email into a task', 'Create a task from the project update email']
      }
    ]
  },
  {
    category: 'Task Management',
    icon: CheckSquare,
    commands: [
      {
        title: 'Create Task',
        description: 'Add a new task with natural language',
        examples: ['Create task: Review Q4 budget', 'Add a task to call Sarah tomorrow']
      },
      {
        title: 'Find Tasks',
        description: 'Search and filter your tasks',
        examples: ['Show me high priority tasks', 'What tasks are due this week?', 'Find all design tasks']
      },
      {
        title: 'Complete Task',
        description: 'Mark a task as completed',
        examples: ['Complete the budget review task', 'Mark design mockup as done']
      }
    ]
  },
  {
    category: 'Preferences & Settings',
    icon: Settings,
    commands: [
      {
        title: 'Update Preferences',
        description: 'Change your work preferences and schedule settings',
        examples: ['I prefer lunch at 11:30 now', 'Change my work hours to 8am-4pm', 'I need longer breaks']
      },
      {
        title: 'View Preferences',
        description: 'See your current preferences and settings',
        examples: ['Show my preferences', 'What are my work hours?', 'When is my lunch break?']
      }
    ]
  },
  {
    category: 'Workflows',
    icon: Workflow,
    commands: [
      {
        title: 'Daily Planning',
        description: 'Run the adaptive daily planning workflow',
        examples: ['Run daily planning', 'Optimize my schedule', 'Reorganize my day']
      }
    ]
  }
];

// Most common commands for the concise view
const commonCommands = [
  { text: 'Plan my day', icon: Calendar },
  { text: 'Check my emails', icon: Mail },
  { text: 'Show my tasks', icon: CheckSquare },
  { text: 'What\'s next?', icon: Clock },
];

interface CommandListMessageProps {
  onCommandSelect?: (command: string) => void;
  className?: string;
  showAll?: boolean;
}

export function CommandListMessage({ 
  onCommandSelect,
  className,
  showAll = false
}: CommandListMessageProps) {
  if (showAll) {
    // Full command list view
    return (
      <div className={cn('space-y-6', className)}>
        <div className="text-center space-y-2">
          <Command className="h-8 w-8 mx-auto text-primary opacity-80" />
          <h3 className="text-lg font-semibold">All Available Commands</h3>
          <p className="text-sm text-muted-foreground">
            Click any example to use it
          </p>
        </div>

        <div className="space-y-6">
          {allCommands.map((category, idx) => {
            const Icon = category.icon;
            return (
              <div key={idx} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-primary" />
                  <span>{category.category}</span>
                </div>
                
                <div className="space-y-3 ml-6">
                  {category.commands.map((command, cmdIdx) => (
                    <div 
                      key={cmdIdx}
                      className="space-y-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div>
                        <h4 className="text-sm font-medium">{command.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {command.description}
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {command.examples.map((example, exIdx) => (
                          <button
                            key={exIdx}
                            onClick={() => onCommandSelect?.(example)}
                            className={cn(
                              'text-xs px-2 py-1 rounded-md',
                              'bg-background hover:bg-primary/10',
                              'border border-border hover:border-primary/20',
                              'transition-colors cursor-pointer'
                            )}
                          >
                            "{example}"
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center space-y-2 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            You can also ask me anything else! I'll do my best to help.
          </p>
        </div>
      </div>
    );
  }

  // Concise starting message
  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center space-y-2">
        <Zap className="h-8 w-8 mx-auto text-primary opacity-80" />
        <h3 className="text-lg font-semibold">Hi! I'm dayli, your AI assistant</h3>
        <p className="text-sm text-muted-foreground">
          Here are some things you can ask me:
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
        {commonCommands.map((cmd, idx) => {
          const Icon = cmd.icon;
          return (
            <button
              key={idx}
              onClick={() => onCommandSelect?.(cmd.text)}
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg',
                'bg-muted/50 hover:bg-muted',
                'border border-transparent hover:border-border',
                'transition-all cursor-pointer text-left',
                'group'
              )}
            >
              <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm">{cmd.text}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Type <code className="px-1 py-0.5 bg-muted rounded">/commands</code> to see all available commands
      </p>
    </div>
  );
}

export default CommandListMessage; 