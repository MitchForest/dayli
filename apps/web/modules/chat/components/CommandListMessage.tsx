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
        description: 'Create an intelligent schedule with work blocks, breaks, and email time',
        examples: ['Plan my day', 'Schedule my day for tomorrow', 'Create a schedule for July 5th']
      },
      {
        title: 'View Schedule',
        description: 'See your current schedule and time blocks',
        examples: ['Show my schedule', 'What\'s on my calendar today?', 'View tomorrow\'s schedule']
      },
      {
        title: 'Create Time Block',
        description: 'Add a new time block to your schedule',
        examples: ['Block 2pm-4pm for deep work', 'Add a break at 3pm', 'Create a meeting from 10-11am']
      },
      {
        title: 'Move Time Block',
        description: 'Reschedule an existing time block',
        examples: ['Move my 2pm block to 4pm', 'Reschedule the design review', 'Change my break to 3:30pm']
      },
      {
        title: 'Delete Time Block',
        description: 'Remove a time block from your schedule',
        examples: ['Delete my 3pm meeting', 'Remove the afternoon break', 'Cancel the work block']
      }
    ]
  },
  {
    category: 'Task Management',
    icon: CheckSquare,
    commands: [
      {
        title: 'Fill Work Block',
        description: 'Automatically assign the best tasks to a work block',
        examples: ['Fill my morning work block', 'What should I work on in my next block?', 'Assign tasks to my 2pm block']
      },
      {
        title: 'View Tasks',
        description: 'See your tasks with priority scores',
        examples: ['Show my tasks', 'What tasks are high priority?', 'List all pending tasks']
      },
      {
        title: 'Create Task',
        description: 'Add a new task with natural language',
        examples: ['Create task: Review Q4 budget', 'Add a task to call Sarah tomorrow', 'New task: Update documentation']
      },
      {
        title: 'Update Task',
        description: 'Modify an existing task',
        examples: ['Update task priority to high', 'Change task deadline to Friday', 'Edit the budget review task']
      },
      {
        title: 'Complete Task',
        description: 'Mark a task as completed',
        examples: ['Complete the budget review task', 'Mark design mockup as done', 'Finish task #123']
      }
    ]
  },
  {
    category: 'Email Management',
    icon: Mail,
    commands: [
      {
        title: 'Fill Email Block',
        description: 'Organize emails by urgency and batch by sender for an email block',
        examples: ['Fill my email block', 'Organize emails for my email time', 'What emails should I process?']
      },
      {
        title: 'View Emails',
        description: 'See your unread emails with urgency scores',
        examples: ['Show my emails', 'What emails need attention?', 'List unread emails']
      },
      {
        title: 'Read Email',
        description: 'Read a specific email with AI-powered summary',
        examples: ['Read the latest email', 'Show email from John', 'Read email about the project update']
      },
      {
        title: 'Process Email',
        description: 'Take action on an email (reply, task, archive)',
        examples: ['Reply to John\'s email', 'Turn this email into a task', 'Archive marketing emails']
      }
    ]
  },
  {
    category: 'Calendar & Meetings',
    icon: Clock,
    commands: [
      {
        title: 'Schedule Meeting',
        description: 'Create a new meeting and find the best time',
        examples: ['Schedule a meeting with Sarah at 2pm', 'Book 30 minutes with the team tomorrow', 'Create a 1-hour design review']
      },
      {
        title: 'Reschedule Meeting',
        description: 'Move an existing meeting to a new time',
        examples: ['Reschedule my 2pm meeting', 'Move the team sync to 4pm', 'Change the design review to tomorrow']
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
      }
    ]
  },
  {
    category: 'System & Workflows',
    icon: Workflow,
    commands: [
      {
        title: 'Confirm Proposal',
        description: 'Confirm or reject a workflow proposal',
        examples: ['Confirm the schedule', 'Accept the task assignments', 'Reject the proposal']
      },
      {
        title: 'Show Workflow History',
        description: 'View past workflow executions',
        examples: ['Show workflow history', 'What workflows ran today?', 'View past schedules']
      },
      {
        title: 'Clear Context',
        description: 'Clear the AI\'s context and start fresh',
        examples: ['Clear context', 'Start over', 'Reset conversation']
      }
    ]
  }
];

// Most common commands for the concise view
const commonCommands = [
  { text: 'Plan my day', icon: Calendar },
  { text: 'Show my schedule', icon: Clock },
  { text: 'What should I work on?', icon: CheckSquare },
  { text: 'Show my emails', icon: Mail },
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