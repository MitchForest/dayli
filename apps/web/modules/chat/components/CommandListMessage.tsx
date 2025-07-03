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
  Command,
  HelpCircle
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
        description: 'Create an intelligent schedule with review before applying',
        examples: ['Plan my day', 'Schedule my day for tomorrow', 'Create a schedule for July 5th']
      },
      {
        title: 'View Schedule',
        description: 'See your current schedule and time blocks',
        examples: ['Show my schedule', 'What\'s on my calendar today?', 'View tomorrow\'s schedule']
      },
      {
        title: 'Find Free Time',
        description: 'Discover available time slots in your schedule',
        examples: ['Find gaps in my schedule', 'Show me free time today', 'When am I available?']
      },
      {
        title: 'Analyze Schedule',
        description: 'Get insights about your schedule efficiency',
        examples: ['Analyze my schedule', 'How efficient is my day?', 'Show schedule utilization']
      },
      {
        title: 'Create Time Block',
        description: 'Add a new time block to your schedule',
        examples: ['Block 2pm-4pm for deep work', 'Add a break at 3pm', 'Create a meeting block']
      },
      {
        title: 'Move Time Block',
        description: 'Reschedule an existing time block',
        examples: ['Move my work block to 3pm', 'Reschedule the meeting', 'Change block time']
      },
      {
        title: 'Delete Time Block',
        description: 'Remove a time block from your schedule',
        examples: ['Delete the 2pm block', 'Remove the meeting', 'Cancel work block']
      }
    ]
  },
  {
    category: 'Task Management',
    icon: CheckSquare,
    commands: [
      {
        title: 'Fill Work Block',
        description: 'Get task suggestions for a work block with approval',
        examples: ['Fill my morning work block', 'What should I work on?', 'Assign tasks to block']
      },
      {
        title: 'View Tasks',
        description: 'See your tasks with priority scores',
        examples: ['Show my tasks', 'List all tasks', 'What are my priorities?']
      },
      {
        title: 'View Scored Backlog',
        description: 'See tasks with calculated priority scores',
        examples: ['Show task scores', 'What are my top tasks?', 'View prioritized backlog']
      },
      {
        title: 'Suggest Tasks for Time',
        description: 'Get task combinations that fit your available time',
        examples: ['What can I do in 30 minutes?', 'Suggest tasks for 2 hours', 'Quick task ideas']
      },
      {
        title: 'Create Task',
        description: 'Add a new task to your list',
        examples: ['Create task: Review proposal', 'Add task to call John', 'New task: Update website']
      },
      {
        title: 'Complete Task',
        description: 'Mark a task as done',
        examples: ['Complete task #123', 'Mark "Review proposal" as done', 'Finish the first task']
      }
    ]
  },
  {
    category: 'Email Management',
    icon: Mail,
    commands: [
      {
        title: 'Process Emails',
        description: 'Get email triage plan with review before processing',
        examples: ['Help me process emails', 'Triage my inbox', 'Fill my email block']
      },
      {
        title: 'View Email Backlog',
        description: 'See unread and backlog emails',
        examples: ['Show email backlog', 'How many unread emails?', 'List pending emails']
      },
      {
        title: 'Categorize Emails',
        description: 'Auto-categorize emails by urgency and type',
        examples: ['Categorize my emails', 'Sort emails by priority', 'Analyze email urgency']
      },
      {
        title: 'Group by Sender',
        description: 'Group emails for batch processing',
        examples: ['Group emails by sender', 'Show email batches', 'Organize by contact']
      },
      {
        title: 'View Emails',
        description: 'See your email list',
        examples: ['Show my emails', 'List recent emails', 'Check inbox']
      },
      {
        title: 'Read Email',
        description: 'Read a specific email',
        examples: ['Read email #123', 'Show the latest email', 'Open email from John']
      },
      {
        title: 'Process Email',
        description: 'Take action on an email',
        examples: ['Archive this email', 'Create task from email', 'Reply to this email']
      }
    ]
  },
  {
    category: 'Meetings & Calendar',
    icon: Clock,
    commands: [
      {
        title: 'Schedule Meeting',
        description: 'Schedule a new meeting with conflict detection',
        examples: ['Schedule meeting with Sarah at 2pm', 'Book a call tomorrow', 'Set up team meeting']
      },
      {
        title: 'Reschedule Meeting',
        description: 'Move an existing meeting',
        examples: ['Reschedule the 2pm meeting', 'Move tomorrow\'s call', 'Change meeting time']
      }
    ]
  },
  {
    category: 'Settings & Preferences',
    icon: Settings,
    commands: [
      {
        title: 'Update Preferences',
        description: 'Change your work preferences',
        examples: ['Change work hours to 9-5', 'Set focus time to mornings', 'Update break duration']
      }
    ]
  },
  {
    category: 'System & Help',
    icon: HelpCircle,
    commands: [
      {
        title: 'Show Patterns',
        description: 'View insights about your work patterns',
        examples: ['Show my patterns', 'What are my habits?', 'Analyze my behavior']
      },
      {
        title: 'Workflow History',
        description: 'See past workflow executions',
        examples: ['Show workflow history', 'What did I do yesterday?', 'View past actions']
      },
      {
        title: 'Clear Context',
        description: 'Start fresh with a new conversation',
        examples: ['Clear context', 'Start over', 'Reset conversation']
      },
      {
        title: 'Provide Feedback',
        description: 'Share feedback about the AI assistant',
        examples: ['I have feedback', 'Report an issue', 'Suggest improvement']
      }
    ]
  }
];

// Most common commands for the concise view - updated for workflows
const commonCommands = [
  { text: 'Plan my day', icon: Calendar },
  { text: 'What should I work on?', icon: CheckSquare },
  { text: 'Process my emails', icon: Mail },
  { text: 'Show my schedule', icon: Clock },
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