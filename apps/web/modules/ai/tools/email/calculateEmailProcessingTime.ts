import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';

const emailSchema = z.object({
  id: z.string(),
  subject: z.string(),
  preview: z.string(),
  urgency: z.enum(['urgent', 'important', 'normal']).optional(),
  importance: z.enum(['important', 'not_important', 'archive']).optional(),
  hasAttachments: z.boolean().optional(),
  wordCount: z.number().optional(),
});

interface EmailTimeEstimate {
  emailId: string;
  subject: string;
  estimatedMinutes: number;
  factors: {
    baseTime: number;
    urgencyMultiplier: number;
    complexityBonus: number;
    attachmentBonus: number;
  };
}

export const calculateEmailProcessingTime = tool({
  description: 'Estimate time needed to process emails based on complexity and type',
  parameters: z.object({
    emails: z.array(emailSchema).describe('Array of emails to estimate processing time'),
  }),
  execute: async ({ emails }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'calculateEmailProcessingTime',
      operation: 'execute' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      
      const estimates: EmailTimeEstimate[] = emails.map(email => {
        // Base time: 2-5 minutes depending on type
        let baseTime = 3;
        
        // Urgency multiplier
        let urgencyMultiplier = 1;
        if (email.urgency === 'urgent') {
          urgencyMultiplier = 1.5; // Urgent emails often need more careful response
        } else if (email.importance === 'archive') {
          urgencyMultiplier = 0.2; // Just needs archiving
        }
        
        // Complexity bonus based on content
        let complexityBonus = 0;
        const wordCount = email.wordCount || email.preview.split(' ').length;
        if (wordCount > 200) {
          complexityBonus += 2; // Longer emails take more time
        }
        if (email.subject.toLowerCase().includes('report') || 
            email.subject.toLowerCase().includes('analysis')) {
          complexityBonus += 3; // Reports need careful review
        }
        if (email.subject.toLowerCase().includes('urgent') ||
            email.subject.toLowerCase().includes('asap')) {
          complexityBonus += 1; // Time-sensitive items need quick but careful handling
        }
        
        // Attachment bonus
        const attachmentBonus = email.hasAttachments ? 2 : 0;
        
        // Calculate total
        const estimatedMinutes = Math.ceil(
          (baseTime * urgencyMultiplier) + complexityBonus + attachmentBonus
        );
        
        return {
          emailId: email.id,
          subject: email.subject,
          estimatedMinutes,
          factors: {
            baseTime,
            urgencyMultiplier,
            complexityBonus,
            attachmentBonus,
          },
        };
      });
      
      // Calculate totals
      const totalMinutes = estimates.reduce((sum, est) => sum + est.estimatedMinutes, 0);
      const averageMinutes = estimates.length > 0 ? Math.round(totalMinutes / estimates.length) : 0;
      
      // Group by time buckets
      const quickEmails = estimates.filter(e => e.estimatedMinutes <= 2);
      const standardEmails = estimates.filter(e => e.estimatedMinutes > 2 && e.estimatedMinutes <= 5);
      const complexEmails = estimates.filter(e => e.estimatedMinutes > 5);
      
      return buildToolResponse(
        toolOptions,
        {
          estimates,
          summary: {
            totalEmails: emails.length,
            totalMinutes,
            totalHours: (totalMinutes / 60).toFixed(1),
            averageMinutes,
            breakdown: {
              quick: quickEmails.length,
              standard: standardEmails.length,
              complex: complexEmails.length,
            },
          },
        },
        {
          type: 'card',
          title: 'Email Processing Time Estimate',
          description: `${emails.length} emails will take approximately ${totalMinutes} minutes (${(totalMinutes / 60).toFixed(1)} hours)`,
          priority: totalMinutes > 120 ? 'high' : 'medium',
          components: [{
            type: 'progressIndicator',
            data: {
              current: 0,
              total: totalMinutes,
              label: 'Estimated Processing Time',
              percentage: 0,
            },
          }],
        },
        {
          suggestions: [
            totalMinutes > 60 ? 'Schedule focused email time' : null,
            complexEmails.length > 3 ? 'Delegate complex emails' : null,
            'Use templates for common responses',
            'Batch similar emails together',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: 'info',
            message: `Processing all emails will take about ${(totalMinutes / 60).toFixed(1)} hours`,
            duration: 4000,
          },
        }
      );
      
    } catch (error) {
      console.error('[CALCULATE EMAIL TIME] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Calculation Failed',
          description: 'Could not estimate email processing time.',
        }
      );
    }
  },
}); 