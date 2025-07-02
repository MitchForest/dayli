import { tool } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { type UniversalToolResponse } from '../../schemas/universal.schema';
import { buildToolResponse, buildErrorResponse } from '../../utils/tool-helpers';
import { ensureServicesConfigured } from '../utils/auth';

const emailAnalysisSchema = z.object({
  importance: z.enum(['important', 'not_important', 'archive']),
  urgency: z.enum(['urgent', 'can_wait', 'no_response']),
  suggestedAction: z.enum(['reply_now', 'reply_later', 'delegate', 'archive', 'no_action']),
  reasoning: z.string(),
  estimatedResponseTime: z.number().describe('Estimated minutes to respond'),
  keyPoints: z.array(z.string()).max(3),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']),
});

export const analyzeSingleEmail = tool({
  description: 'Analyze email importance and urgency using AI',
  parameters: z.object({
    from: z.string().describe('Sender name'),
    fromEmail: z.string().email().describe('Sender email address'),
    subject: z.string().describe('Email subject'),
    content: z.string().describe('Email body content'),
    receivedAt: z.string().describe('When the email was received'),
  }),
  execute: async (params): Promise<UniversalToolResponse> => {
    const startTime = Date.now();
    const toolOptions = {
      toolName: 'analyzeSingleEmail',
      operation: 'execute' as const,
      resourceType: 'email' as const,
      startTime,
    };
    
    try {
      await ensureServicesConfigured();
      
      // Use AI to analyze the email
      const analysis = await generateObject({
        model: openai('gpt-4-turbo'),
        schema: emailAnalysisSchema,
        prompt: `Analyze this email and determine its importance and urgency:

From: ${params.from} <${params.fromEmail}>
Subject: ${params.subject}
Received: ${params.receivedAt}

Content:
${params.content}

Consider:
1. Who the sender is (VIP, colleague, external)
2. The subject matter and content urgency
3. Any deadlines or time-sensitive information
4. The tone and sentiment
5. Whether it requires a response

Provide:
- Importance level (important/not_important/archive)
- Urgency level (urgent/can_wait/no_response)
- Suggested action
- Brief reasoning
- Estimated response time in minutes
- Up to 3 key points
- Overall sentiment`,
      });
      
      return buildToolResponse(
        toolOptions,
        {
          emailId: `email_${Date.now()}`, // In real impl, this would be the actual email ID
          analysis: analysis.object,
        },
        {
          type: 'card',
          title: 'Email Analysis Complete',
          description: `${params.subject} - ${analysis.object.suggestedAction.replace('_', ' ')}`,
          priority: analysis.object.urgency === 'urgent' ? 'high' : 'medium',
          components: [{
            type: 'emailPreview',
            data: {
              id: `email_${Date.now()}`,
              from: params.from,
              fromEmail: params.fromEmail,
              subject: params.subject,
              preview: params.content.slice(0, 150) + '...',
              receivedAt: params.receivedAt,
              isRead: false,
              hasAttachments: false,
              urgency: analysis.object.urgency === 'urgent' ? 'urgent' : 
                       analysis.object.importance === 'important' ? 'important' : 'normal',
            },
          }],
        },
        {
          notification: {
            show: true,
            type: 'info',
            message: `Email analyzed: ${analysis.object.importance}, ${analysis.object.urgency}`,
            duration: 3000,
          },
          suggestions: [
            analysis.object.suggestedAction === 'reply_now' ? 'Draft a response' : null,
            analysis.object.suggestedAction === 'delegate' ? 'Forward to team' : null,
            'Add to task list',
            'Set reminder',
          ].filter(Boolean) as string[],
        }
      );
      
    } catch (error) {
      console.error('[ANALYZE EMAIL] Error:', error);
      return buildErrorResponse(
        toolOptions,
        error,
        {
          title: 'Analysis Failed',
          description: 'Could not analyze the email. Please try again.',
        }
      );
    }
  },
}); 