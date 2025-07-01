import type { IGmailService } from '../interfaces/gmail.interface';

// Matches Gmail API v1 format exactly
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    body: {
      data: string; // Base64 encoded
    };
    parts?: Array<{
      partId: string;
      mimeType: string;
      body: {
        data: string;
      };
    }>;
  };
  sizeEstimate: number;
  historyId: string;
  internalDate: string; // Epoch ms as string
}

interface GmailListResponse {
  messages: Array<{
    id: string;
    threadId: string;
  }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export class MockGmailService implements IGmailService {
  private messages: Map<string, GmailMessage> = new Map();
  
  constructor() {
    this.generateRealisticEmails();
  }

  private generateRealisticEmails(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Email templates
    const emailTemplates = [
      // Newsletters (morning delivery)
      {
        from: 'TechCrunch <newsletter@techcrunch.com>',
        subject: 'Daily Crunch: Big Tech earnings preview',
        body: 'Here are the top tech stories for today...',
        hour: 6,
        labelIds: ['UNREAD', 'CATEGORY_UPDATES']
      },
      {
        from: 'Morning Brew <crew@morningbrew.com>',
        subject: 'Your daily business brief',
        body: 'Good morning! Here\'s what you need to know today...',
        hour: 6,
        labelIds: ['UNREAD', 'CATEGORY_UPDATES']
      },
      
      // Work emails (business hours)
      {
        from: 'Sarah Chen <sarah.chen@company.com>',
        subject: 'Re: Q4 Budget Review',
        body: 'Hi, I\'ve reviewed the budget proposal and have a few questions about the marketing allocation...',
        hour: 9,
        labelIds: ['UNREAD', 'IMPORTANT', 'CATEGORY_PRIMARY']
      },
      {
        from: 'Michael Rodriguez <michael.r@company.com>',
        subject: 'Meeting notes from product sync',
        body: 'Thanks for joining the sync today. Here are the key action items we discussed...',
        hour: 14,
        labelIds: ['UNREAD', 'CATEGORY_PRIMARY']
      },
      
      // Meeting invites
      {
        from: 'calendar-notification@google.com',
        subject: 'Invitation: Design Review @ Thu Jan 4, 2024 2pm - 3pm (EST)',
        body: 'You have been invited to the following event...',
        hour: 10,
        labelIds: ['UNREAD', 'CATEGORY_UPDATES']
      },
      
      // Follow-ups
      {
        from: 'David Kim <david.kim@partner.com>',
        subject: 'Following up on our partnership discussion',
        body: 'Hi, I wanted to follow up on our conversation last week about the potential partnership...',
        hour: 11,
        labelIds: ['UNREAD', 'CATEGORY_PRIMARY']
      },
      
      // Urgent requests
      {
        from: 'Jessica Martinez <jessica.m@company.com>',
        subject: 'URGENT: Need approval for vendor contract',
        body: 'Hi, I need your approval on the attached vendor contract by EOD today...',
        hour: 15,
        labelIds: ['UNREAD', 'IMPORTANT', 'STARRED', 'CATEGORY_PRIMARY']
      },
      
      // Social notifications
      {
        from: 'LinkedIn <notifications-noreply@linkedin.com>',
        subject: 'You have 5 new profile views',
        body: 'Your profile is getting noticed! See who viewed your profile this week...',
        hour: 12,
        labelIds: ['UNREAD', 'CATEGORY_SOCIAL']
      }
    ];

    // Generate emails for the past 7 days
    for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
      const dayTimestamp = now - (daysAgo * oneDayMs);
      
      // Generate 10-20 emails per day
      const emailCount = Math.floor(Math.random() * 10) + 10;
      
      for (let i = 0; i < emailCount; i++) {
        const templateIndex = Math.floor(Math.random() * emailTemplates.length);
        const template = emailTemplates[templateIndex]!;
        const emailTime = new Date(dayTimestamp);
        emailTime.setHours(template.hour + Math.floor(Math.random() * 3));
        emailTime.setMinutes(Math.floor(Math.random() * 60));
        
        const messageId = `msg_${daysAgo}_${i}_${Math.random().toString(36).substr(2, 9)}`;
        const threadId = `thread_${Math.random().toString(36).substr(2, 9)}`;
        
        const message: GmailMessage = {
          id: messageId,
          threadId: threadId,
          labelIds: [...template.labelIds],
          snippet: template.body.substring(0, 100) + '...',
          payload: {
            headers: [
              { name: 'From', value: template.from },
              { name: 'Subject', value: template.subject },
              { name: 'Date', value: emailTime.toUTCString() },
              { name: 'To', value: 'user@example.com' }
            ],
            body: {
              data: Buffer.from(template.body).toString('base64')
            }
          },
          sizeEstimate: template.body.length,
          historyId: Math.floor(Math.random() * 1000000).toString(),
          internalDate: emailTime.getTime().toString()
        };
        
        // Mark some emails as read (older ones more likely)
        if (daysAgo > 2 && Math.random() > 0.3) {
          message.labelIds = message.labelIds.filter(label => label !== 'UNREAD');
        }
        
        this.messages.set(messageId, message);
      }
    }
  }

  async listMessages(params: {
    userId: string;
    q?: string;
    pageToken?: string;
    maxResults?: number;
  }): Promise<GmailListResponse> {
    const maxResults = params.maxResults || 50;
    const allMessages = Array.from(this.messages.values());
    
    // Apply query filter if provided
    let filteredMessages = allMessages;
    if (params.q) {
      const query = params.q.toLowerCase();
      filteredMessages = allMessages.filter(msg => {
        const fromHeader = msg.payload.headers.find(h => h.name === 'From');
        const subjectHeader = msg.payload.headers.find(h => h.name === 'Subject');
        
        return (
          (fromHeader?.value.toLowerCase().includes(query) || false) ||
          (subjectHeader?.value.toLowerCase().includes(query) || false) ||
          msg.snippet.toLowerCase().includes(query)
        );
      });
    }
    
    // Sort by date (newest first)
    filteredMessages.sort((a, b) => 
      parseInt(b.internalDate) - parseInt(a.internalDate)
    );
    
    // Implement pagination
    const startIndex = params.pageToken ? parseInt(params.pageToken) : 0;
    const endIndex = Math.min(startIndex + maxResults, filteredMessages.length);
    const pageMessages = filteredMessages.slice(startIndex, endIndex);
    
    return {
      messages: pageMessages.map(msg => ({
        id: msg.id,
        threadId: msg.threadId
      })),
      nextPageToken: endIndex < filteredMessages.length ? endIndex.toString() : undefined,
      resultSizeEstimate: filteredMessages.length
    };
  }

  async getMessage(params: {
    userId: string;
    id: string;
  }): Promise<GmailMessage | null> {
    return this.messages.get(params.id) || null;
  }

  // Helper method to get all messages (for seeding database)
  getAllMessages(): GmailMessage[] {
    return Array.from(this.messages.values());
  }
} 