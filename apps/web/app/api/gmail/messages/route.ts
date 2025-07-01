import { NextRequest, NextResponse } from 'next/server';
import { MockGmailService } from '@/services/mock/gmail.service';
import type { IGmailService } from '@/services/interfaces/gmail.interface';

// For now, always use mock service until real Gmail integration is implemented
const getGmailService = (): IGmailService => {
  return new MockGmailService();
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'me';
    const q = searchParams.get('q') || undefined;
    const pageToken = searchParams.get('pageToken') || undefined;
    const maxResults = searchParams.get('maxResults') 
      ? parseInt(searchParams.get('maxResults')!) 
      : undefined;
    
    const gmailService = getGmailService();
    const messages = await gmailService.listMessages({
      userId,
      q,
      pageToken,
      maxResults,
    });
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
} 