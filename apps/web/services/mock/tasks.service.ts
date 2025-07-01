import type { TaskInsert } from '@repo/database/types';

export class MockTaskService {
  generateBacklogTasks(userId: string): Omit<TaskInsert, 'user_id'>[] {
    const tasks: Omit<TaskInsert, 'user_id'>[] = [
      // Strategic tasks
      {
        title: "Review Q1 OKRs and update team goals",
        description: "Analyze Q1 progress and set priorities for Q2",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Prepare board presentation for next week",
        description: "Create slides covering product roadmap and financial projections",
        source: "email",
        status: "backlog",
        completed: false
      },
      {
        title: "Define success metrics for new feature launch",
        description: "Work with product team to establish KPIs",
        source: "manual",
        status: "backlog",
        completed: false
      },
      
      // Development tasks
      {
        title: "Code review for PR #234",
        description: "Review authentication flow changes",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Fix production bug in auth flow",
        description: "Users reporting intermittent login failures",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Implement new API endpoint for dashboard",
        description: "Add aggregation endpoint for performance metrics",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Refactor legacy payment processing code",
        description: "Modernize payment module to use new SDK",
        source: "manual",
        status: "backlog",
        completed: false
      },
      
      // Communication tasks
      {
        title: "Reply to Sarah about project timeline",
        description: "Provide updated estimates for Phase 2 deliverables",
        source: "email",
        status: "backlog",
        completed: false
      },
      {
        title: "Schedule 1:1 with new team member",
        description: "Welcome John and discuss onboarding plan",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Send weekly status update to stakeholders",
        description: "Summarize progress on key initiatives",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Follow up with vendor about contract renewal",
        description: "Negotiate better terms for cloud services",
        source: "email",
        status: "backlog",
        completed: false
      },
      
      // Administrative tasks
      {
        title: "Submit expense report for conference",
        description: "Include receipts from last week's tech conference",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Update team documentation wiki",
        description: "Add new onboarding procedures and API docs",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Complete annual security training",
        description: "Due by end of month",
        source: "email",
        status: "backlog",
        completed: false
      },
      {
        title: "Review and approve team PTO requests",
        description: "Check coverage for upcoming holidays",
        source: "manual",
        status: "backlog",
        completed: false
      },
      
      // Research and analysis
      {
        title: "Research competitor pricing strategies",
        description: "Analyze top 5 competitors' pricing models",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Analyze user feedback from last release",
        description: "Compile insights from support tickets and reviews",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Investigate new ML framework for recommendations",
        description: "POC for improving recommendation accuracy",
        source: "manual",
        status: "backlog",
        completed: false
      },
      
      // Planning tasks
      {
        title: "Create project plan for mobile app redesign",
        description: "Define milestones and resource allocation",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Draft Q2 hiring plan",
        description: "Identify key roles and budget requirements",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Plan team offsite agenda",
        description: "Organize activities and sessions for team building",
        source: "email",
        status: "backlog",
        completed: false
      },
      
      // Customer-related tasks
      {
        title: "Call enterprise client about renewal",
        description: "Discuss expansion opportunities",
        source: "email",
        status: "backlog",
        completed: false
      },
      {
        title: "Prepare demo for potential partner",
        description: "Customize demo for healthcare use case",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Respond to customer escalation",
        description: "Address concerns about recent service disruption",
        source: "email",
        status: "backlog",
        completed: false
      },
      
      // Personal development
      {
        title: "Complete online course on system design",
        description: "Finish remaining 3 modules",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Prepare talk for engineering meetup",
        description: "Topic: Scaling microservices in production",
        source: "manual",
        status: "backlog",
        completed: false
      },
      
      // Maintenance tasks
      {
        title: "Update dependencies in main repository",
        description: "Security patches and version bumps",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Clean up old feature flags",
        description: "Remove flags for features launched >6 months ago",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Archive completed project repositories",
        description: "Move inactive repos to cold storage",
        source: "manual",
        status: "backlog",
        completed: false
      },
      
      // Process improvements
      {
        title: "Optimize CI/CD pipeline performance",
        description: "Reduce build times by 30%",
        source: "manual",
        status: "backlog",
        completed: false
      },
      {
        title: "Implement automated testing for edge cases",
        description: "Increase test coverage to 90%",
        source: "manual",
        status: "backlog",
        completed: false
      }
    ];
    
    // Shuffle tasks to create variety
    const shuffled = [...tasks].sort(() => Math.random() - 0.5);
    
    // Return 30-40 random tasks
    const taskCount = Math.floor(Math.random() * 10) + 30;
    return shuffled.slice(0, taskCount);
  }
} 