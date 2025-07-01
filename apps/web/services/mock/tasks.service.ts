import type { TablesInsert } from '@repo/database/types';

type TaskInsert = TablesInsert<'tasks'>;

export class MockTaskService {
  generateBacklogTasks(userId: string): TaskInsert[] {
    const taskTemplates = [
      // High priority technical tasks
      {
        title: 'Review and merge critical security PR',
        description: 'Security patch for authentication vulnerability needs immediate review',
        priority: 'high',
        estimatedMinutes: 45,
        source: 'manual' as const,
        tags: ['security', 'urgent', 'code-review']
      },
      {
        title: 'Fix production database performance issue',
        description: 'Users reporting slow queries on the dashboard, needs investigation',
        priority: 'high',
        estimatedMinutes: 120,
        source: 'manual' as const,
        tags: ['production', 'performance', 'database']
      },
      {
        title: 'Prepare for client demo tomorrow',
        description: 'Set up demo environment and test all features for important client presentation',
        priority: 'high',
        estimatedMinutes: 90,
        source: 'calendar' as const,
        tags: ['client', 'demo', 'urgent']
      },
      
      // Medium priority development tasks
      {
        title: 'Implement user feedback form',
        description: 'Add feedback collection form to gather user insights on new features',
        priority: 'medium',
        estimatedMinutes: 180,
        source: 'manual' as const,
        tags: ['feature', 'frontend', 'user-experience']
      },
      {
        title: 'Refactor authentication module',
        description: 'Clean up auth code and improve error handling based on code review feedback',
        priority: 'medium',
        estimatedMinutes: 240,
        source: 'manual' as const,
        tags: ['refactoring', 'backend', 'auth']
      },
      {
        title: 'Write unit tests for payment service',
        description: 'Increase test coverage for payment processing module to 80%',
        priority: 'medium',
        estimatedMinutes: 150,
        source: 'manual' as const,
        tags: ['testing', 'quality', 'backend']
      },
      {
        title: 'Update API documentation',
        description: 'Document new endpoints and update examples for v2 API',
        priority: 'medium',
        estimatedMinutes: 90,
        source: 'manual' as const,
        tags: ['documentation', 'api']
      },
      {
        title: 'Optimize image loading performance',
        description: 'Implement lazy loading and WebP format for better page speed',
        priority: 'medium',
        estimatedMinutes: 120,
        source: 'manual' as const,
        tags: ['performance', 'frontend', 'optimization']
      },
      
      // Email-originated tasks
      {
        title: 'Respond to partner integration proposal',
        description: 'Review technical requirements from potential partner and provide feedback',
        priority: 'medium',
        estimatedMinutes: 60,
        source: 'email' as const,
        tags: ['partnership', 'planning', 'email-followup']
      },
      {
        title: 'Schedule architecture review meeting',
        description: 'Set up meeting to discuss microservices migration plan with team',
        priority: 'medium',
        estimatedMinutes: 30,
        source: 'email' as const,
        tags: ['meeting', 'architecture', 'planning']
      },
      {
        title: 'Review contract for new vendor',
        description: 'Legal sent over SaaS vendor contract for technical review',
        priority: 'medium',
        estimatedMinutes: 45,
        source: 'email' as const,
        tags: ['vendor', 'legal', 'review']
      },
      
      // Low priority but important tasks
      {
        title: 'Research new monitoring tools',
        description: 'Evaluate alternatives to current APM solution for better cost efficiency',
        priority: 'low',
        estimatedMinutes: 120,
        source: 'manual' as const,
        tags: ['research', 'devops', 'tooling']
      },
      {
        title: 'Clean up old feature flags',
        description: 'Remove feature flags for launched features from last quarter',
        priority: 'low',
        estimatedMinutes: 60,
        source: 'manual' as const,
        tags: ['cleanup', 'maintenance', 'backend']
      },
      {
        title: 'Update team wiki with learnings',
        description: 'Document lessons learned from recent production incident',
        priority: 'low',
        estimatedMinutes: 45,
        source: 'manual' as const,
        tags: ['documentation', 'knowledge-sharing']
      },
      {
        title: 'Organize team knowledge sharing session',
        description: 'Prepare presentation on new TypeScript features for team learning',
        priority: 'low',
        estimatedMinutes: 90,
        source: 'manual' as const,
        tags: ['team', 'learning', 'presentation']
      },
      
      // Recurring maintenance tasks
      {
        title: 'Weekly dependency updates',
        description: 'Review and update npm dependencies for security patches',
        priority: 'low',
        estimatedMinutes: 30,
        source: 'manual' as const,
        tags: ['maintenance', 'security', 'dependencies']
      },
      {
        title: 'Review and close stale GitHub issues',
        description: 'Clean up issue tracker by closing outdated or resolved issues',
        priority: 'low',
        estimatedMinutes: 45,
        source: 'manual' as const,
        tags: ['maintenance', 'github', 'cleanup']
      },
      
      // Personal development
      {
        title: 'Complete online course module',
        description: 'Finish next module in advanced React patterns course',
        priority: 'low',
        estimatedMinutes: 90,
        source: 'manual' as const,
        tags: ['learning', 'personal-development', 'react']
      },
      {
        title: 'Read engineering blog posts',
        description: 'Catch up on saved articles about system design',
        priority: 'low',
        estimatedMinutes: 60,
        source: 'manual' as const,
        tags: ['learning', 'reading', 'system-design']
      }
    ];
    
    // Generate 30-40 tasks with some variation
    const tasks: TaskInsert[] = [];
    const now = new Date();
    
    // Add each template 1-2 times with slight variations
    taskTemplates.forEach((template, index) => {
      const copies = index < 8 ? 2 : 1; // More copies of high/medium priority tasks
      
      for (let i = 0; i < copies; i++) {
        const daysAgo = Math.floor(Math.random() * 14); // Tasks from last 2 weeks
        const createdAt = new Date(now);
        createdAt.setDate(createdAt.getDate() - daysAgo);
        
        // Add some variation to estimated time
        const timeVariation = 0.8 + Math.random() * 0.4; // 80% to 120% of original
        const estimatedMinutes = Math.round(template.estimatedMinutes * timeVariation);
        
        // Occasionally mark some tasks as completed (for past days)
        const isCompleted = daysAgo > 3 && Math.random() < 0.3;
        
        const task: TaskInsert = {
          user_id: userId,
          title: i === 0 ? template.title : `${template.title} (Follow-up)`,
          description: template.description,
          priority: template.priority as 'high' | 'medium' | 'low',
          status: isCompleted ? 'completed' : 'backlog',
          completed: isCompleted,
          estimated_minutes: estimatedMinutes,
          source: template.source,
          email_id: template.source === 'email' ? null : null, // We don't have real email IDs yet
          created_at: createdAt.toISOString(),
          updated_at: createdAt.toISOString()
        };
        
        tasks.push(task);
      }
    });
    
    // Shuffle tasks to mix priorities
    return tasks.sort(() => Math.random() - 0.5);
  }
} 