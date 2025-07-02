import { tool } from 'ai';
import { z } from 'zod';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';
import { ServiceFactory } from '@/services/factory/service.factory';
import { createServerActionClient } from '@/lib/supabase-server';
import { differenceInDays, format } from 'date-fns';

interface SenderPattern {
  senderEmail: string;
  senderName: string;
  totalEmails: number;
  emailsInBacklog: number;
  avgImportance: number;
  avgResponseTime: number | null;
  lastEmailDate: Date;
  firstEmailDate: Date;
  frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  typicalSubjects: string[];
  urgencyDistribution: {
    urgent: number;
    important: number;
    normal: number;
  };
}

export const analyzeSenderPatterns = tool({
  description: 'Analyze communication patterns with a specific sender',
  parameters: z.object({
    senderEmail: z.string().email().describe('Email address of the sender to analyze'),
    includeContent: z.boolean().optional().default(false).describe('Include email content analysis'),
    lookbackDays: z.number().optional().default(90).describe('Number of days to look back'),
  }),
  execute: async ({ senderEmail, includeContent, lookbackDays }): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'analyzeSenderPatterns',
      operation: 'read' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      const gmailService = ServiceFactory.getInstance().getGmailService();
      const supabase = await createServerActionClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      // Search for emails from this sender
      const query = `from:${senderEmail} newer_than:${lookbackDays}d`;
      const result = await gmailService.listMessages({
        q: query,
        maxResults: 100, // Analyze up to 100 emails
      });
      
      if (!result.messages || result.messages.length === 0) {
        return buildToolResponse(
          toolOptions,
          {
            pattern: null,
            message: `No emails found from ${senderEmail} in the last ${lookbackDays} days`,
          },
          {
            type: 'card',
            title: 'No Communication History',
            description: `No emails found from ${senderEmail}`,
            priority: 'low',
            components: [],
          },
          {
            suggestions: ['Try a different email address', 'Extend the lookback period'],
          }
        );
      }
      
      // Fetch email details
      const emailDetails = await Promise.all(
        result.messages.map(async (msg) => {
          const fullMessage = await gmailService.getMessage(msg.id);
          if (!fullMessage) return null;
          
          const headers = fullMessage.payload?.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || '';
          const date = headers.find(h => h.name === 'Date')?.value || '';
          const from = headers.find(h => h.name === 'From')?.value || '';
          
          return {
            id: fullMessage.id,
            subject,
            date: new Date(date),
            from,
            snippet: fullMessage.snippet || '',
          };
        })
      );
      
      const validEmails = emailDetails.filter((e): e is NonNullable<typeof e> => e !== null);
      
      // Check backlog status
      const { data: backlogEmails } = await supabase
        .from('email_backlog')
        .select('email_id, urgency, importance')
        .eq('user_id', user.id)
        .eq('from_email', senderEmail);
      
      const backlogMap = new Map(
        backlogEmails?.map(e => [e.email_id, e]) || []
      );
      
      // Analyze patterns
      const dates = validEmails.map(e => e.date).sort((a, b) => a.getTime() - b.getTime());
      const firstEmail = dates[0];
      const lastEmail = dates[dates.length - 1];
      
      if (!firstEmail || !lastEmail) {
        throw new Error('Unable to determine email date range');
      }
      
      const daySpan = differenceInDays(lastEmail, firstEmail) || 1;
      
      // Calculate frequency
      const avgDaysBetween = daySpan / validEmails.length;
      let frequency: SenderPattern['frequency'];
      if (avgDaysBetween <= 1) frequency = 'daily';
      else if (avgDaysBetween <= 7) frequency = 'weekly';
      else if (avgDaysBetween <= 30) frequency = 'monthly';
      else frequency = 'occasional';
      
      // Analyze subjects
      const subjects = validEmails.map(e => e.subject);
      const commonWords = findCommonWords(subjects);
      const typicalSubjects = Array.from(new Set(
        subjects.filter(s => commonWords.some(word => s.toLowerCase().includes(word)))
      )).slice(0, 3);
      
      // Calculate urgency distribution
      const urgencyDist = {
        urgent: 0,
        important: 0,
        normal: 0,
      };
      
      validEmails.forEach(email => {
        const backlogInfo = backlogMap.get(email.id);
        if (backlogInfo?.urgency === 'urgent') urgencyDist.urgent++;
        else if (backlogInfo?.importance === 'important') urgencyDist.important++;
        else urgencyDist.normal++;
      });
      
      const pattern: SenderPattern = {
        senderEmail,
        senderName: extractName(validEmails[0]?.from || senderEmail),
        totalEmails: validEmails.length,
        emailsInBacklog: backlogMap.size,
        avgImportance: calculateAvgImportance(urgencyDist, validEmails.length),
        avgResponseTime: null, // Would need to track sent emails
        lastEmailDate: lastEmail,
        firstEmailDate: firstEmail,
        frequency,
        typicalSubjects,
        urgencyDistribution: urgencyDist,
      };
      
      return buildToolResponse(
        toolOptions,
        { pattern },
        {
          type: 'card',
          title: 'Sender Pattern Analysis',
          description: `${pattern.senderName} - ${pattern.frequency} communication`,
          priority: pattern.emailsInBacklog > 3 ? 'high' : 'medium',
          components: [
            {
              type: 'progressIndicator',
              data: {
                current: pattern.emailsInBacklog,
                total: pattern.totalEmails,
                label: 'Emails in backlog',
                percentage: (pattern.emailsInBacklog / pattern.totalEmails) * 100,
              },
            },
          ],
        },
        {
          suggestions: [
            pattern.emailsInBacklog > 0 ? `Process ${pattern.emailsInBacklog} backlog emails` : null,
            pattern.frequency === 'daily' ? 'Set up email filter' : null,
            pattern.urgencyDistribution.urgent > 5 ? 'Schedule regular check-ins' : null,
            'View recent emails from sender',
          ].filter(Boolean) as string[],
          notification: {
            show: true,
            type: 'info',
            message: `${pattern.totalEmails} emails analyzed from ${pattern.senderName}`,
            duration: 3000,
          },
        }
      );
      
    } catch (error) {
      console.error('[ANALYZE SENDER PATTERNS] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Analysis Failed',
          description: 'Could not analyze sender patterns.',
        }
      );
    }
  },
});

function extractName(fromHeader: string): string {
  const match = fromHeader.match(/^"?([^"<]+)"?\s*</);
  return match?.[1]?.trim() || fromHeader.split('@')[0] || 'Unknown';
}

function findCommonWords(subjects: string[]): string[] {
  const wordCount = new Map<string, number>();
  
  subjects.forEach(subject => {
    const words = subject.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !['the', 'and', 'for', 'with', 'from'].includes(w));
    
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
  });
  
  return Array.from(wordCount.entries())
    .filter(([_, count]) => count >= subjects.length * 0.2) // Word appears in 20%+ of subjects
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function calculateAvgImportance(urgencyDist: SenderPattern['urgencyDistribution'], total: number): number {
  const score = (urgencyDist.urgent * 3 + urgencyDist.important * 2 + urgencyDist.normal) / total;
  return Math.round(score * 100) / 100;
} 