import { tool } from 'ai';
import { z } from 'zod';
import { toolSuccess, toolError } from '../types';
import { ServiceFactory } from '@/services/factory/service.factory';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export const draftEmailResponse = tool({
  description: "Create a draft email response with AI assistance",
  parameters: z.object({
    replyTo: z.string().optional().describe("Email ID to reply to"),
    to: z.array(z.string()).optional().describe("Recipients if new email"),
    subject: z.string().optional(),
    tone: z.enum(['professional', 'friendly', 'brief', 'detailed']).default('professional'),
    keyPoints: z.array(z.string()).describe("Main points to include"),
    sendImmediately: z.boolean().default(false),
  }),
  execute: async (params) => {
    try {
      const gmailService = ServiceFactory.getInstance().getGmailService();
      
      // Get context if replying
      let context = '';
      let originalSubject = '';
      let threadId: string | undefined;
      let originalFrom = '';
      
      if (params.replyTo) {
        // For now, get the email directly since we can't call tools from within tools
        const email = await gmailService.getMessage(params.replyTo);
        
        if (!email) {
          return toolError(
            'ORIGINAL_EMAIL_NOT_FOUND',
            'Could not find the email to reply to'
          );
        }
        
        // Extract email content similar to readEmailContent
        const headers = email.payload?.headers || [];
        originalSubject = headers.find(h => h.name === 'Subject')?.value || '';
        originalFrom = headers.find(h => h.name === 'From')?.value || '';
        threadId = email.threadId;
        
        // Extract body
        if (email.payload?.parts) {
          for (const part of email.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              context = Buffer.from(part.body.data, 'base64').toString('utf-8');
              break;
            }
          }
        } else if (email.payload?.body?.data) {
          context = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
        }
      }
      
      // Generate response with AI
      const prompt = buildEmailPrompt({
        context,
        tone: params.tone,
        keyPoints: params.keyPoints,
        isReply: !!params.replyTo
      });
      
      const { text: generatedBody } = await generateText({
        model: openai('gpt-4-turbo'),
        prompt,
        temperature: 0.7,
      });
      
      // Prepare email data
      const emailSubject = params.subject || 
        (params.replyTo ? `Re: ${originalSubject}` : 'No Subject');
      
      const recipients = params.to || 
        (params.replyTo && originalFrom ? [extractEmailAddress(originalFrom)] : []);
      
      if (!recipients.length || !recipients[0]) {
        return toolError(
          'NO_RECIPIENTS',
          'No recipients specified and could not extract from original email'
        );
      }
      
      // Create draft or send
      if (params.sendImmediately) {
        const sentMessage = await gmailService.sendMessage({
          to: recipients.join(', '),
          subject: emailSubject,
          body: generatedBody,
          threadId
        });
        
        return toolSuccess({
          sent: true,
          messageId: sentMessage.id,
          threadId: sentMessage.threadId,
          body: generatedBody
        }, {
          type: 'text',
          content: `Email sent successfully to ${recipients.join(', ')}`
        }, {
          affectedItems: [sentMessage.id],
          suggestions: ['View sent email', 'Send another email']
        });
      } else {
        // For now, we'll return the draft content
        // In a real implementation, this would create a Gmail draft
        return toolSuccess({
          sent: false,
          draft: {
            to: recipients,
            subject: emailSubject,
            body: generatedBody,
            threadId
          },
          preview: generatedBody.substring(0, 200) + '...'
        }, {
          type: 'email',
          content: {
            to: recipients,
            subject: emailSubject,
            body: generatedBody
          }
        }, {
          suggestions: ['Send this email', 'Edit the draft', 'Discard']
        });
      }
      
    } catch (error) {
      return toolError(
        'DRAFT_CREATION_FAILED',
        `Failed to create email draft: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  },
});

function buildEmailPrompt({
  context,
  tone,
  keyPoints,
  isReply
}: {
  context: string;
  tone: string;
  keyPoints: string[];
  isReply: boolean;
}): string {
  let prompt = `Write a ${tone} email that includes the following key points:\n`;
  prompt += keyPoints.map(point => `- ${point}`).join('\n');
  
  if (isReply && context) {
    prompt += `\n\nThis is a reply to the following email:\n---\n${context}\n---\n`;
    prompt += `\nMake sure to address the points raised in the original email.`;
  }
  
  prompt += `\n\nTone guidelines:`;
  switch (tone) {
    case 'professional':
      prompt += '\n- Use formal language and proper business etiquette';
      prompt += '\n- Be clear and concise';
      break;
    case 'friendly':
      prompt += '\n- Use a warm, conversational tone';
      prompt += '\n- Include appropriate pleasantries';
      break;
    case 'brief':
      prompt += '\n- Keep it very short and to the point';
      prompt += '\n- Use bullet points if appropriate';
      break;
    case 'detailed':
      prompt += '\n- Provide comprehensive information';
      prompt += '\n- Include relevant context and explanations';
      break;
  }
  
  prompt += '\n\nDo not include a subject line or email headers, just the body content.';
  
  return prompt;
}

function extractEmailAddress(fromHeader: string): string {
  // Extract email from "Name <email@domain.com>" format
  const match = fromHeader.match(/<(.+)>/);
  return match && match[1] ? match[1] : fromHeader;
} 