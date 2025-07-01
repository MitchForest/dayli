import { NextRequest, NextResponse } from 'next/server';
import { MockGmailService } from '@/services/mock/gmail.service';
import type { IGmailService } from '@/services/interfaces/gmail.interface';

// For now, always use mock service until real Gmail integration is implemented
const getGmailService = (): IGmailService => {
  return new MockGmailService();
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'me';
    
    const gmailService = getGmailService();
    const message = await gmailService.getMessage({
      userId,
      id,
    });
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(message);
  } catch (error) {
    console.error('Error fetching Gmail message:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message' },
      { status: 500 }
    );
  }
} 