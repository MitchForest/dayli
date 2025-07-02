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

    const { emails } = await req.json();
    const workflow = createEmailTriageWorkflow(supabase);

    // Run the workflow
    const result = await workflow.invoke({
      userId: user.id,
      emails,
      triageResults: [],
      processedEmails: [],
    });

    return NextResponse.json({
      success: true,
      results: result.triageResults,
    });
  } catch (error) {
    console.error('Email triage error:', error);
    return NextResponse.json(
      { error: 'Failed to triage emails' },
      { status: 500 }
    );
  }
} 