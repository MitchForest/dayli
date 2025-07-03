/*
import { NextRequest, NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase-server';
import { createEmailTriageWorkflow } from '@/modules/workflows/graphs/emailTriage';

export async function POST(req: NextRequest) {
  try {
    // Create server-side Supabase client
    const supabase = await createServerActionClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflow = createEmailTriageWorkflow(supabase);
    
    // Get initial state
    const initialState = {
      userId: user.id,
      emails: [],
      categorizedEmails: {
        urgent: [],
        important: [],
        newsletters: [],
        other: [],
      },
      proposedActions: [],
    };

    // Run the workflow
    const result = await workflow.invoke(initialState);

    return NextResponse.json({
      success: true,
      categorized: result.categorizedEmails,
      actions: result.proposedActions,
    });
  } catch (error) {
    console.error('Email triage workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to run email triage workflow' },
      { status: 500 }
    );
  }
}
*/

// Temporary placeholder until workflow is reimplemented
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Email triage workflow is currently being refactored' },
    { status: 503 }
  );
} 