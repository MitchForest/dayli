'use client';

import { Bot } from 'lucide-react';

export function CommandListMessage() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted">
        <Bot size={16} />
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="bg-card border border-border rounded-lg p-4 max-w-[85%]">
          <h3 className="font-semibold mb-3">📋 Available Commands:</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span><strong>"Plan my day"</strong> - Generate your optimal schedule</span>
            </li>
            <li className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span><strong>"Show me today's emails"</strong> - Start email triage</span>
            </li>
            <li className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span><strong>"Schedule [task] at [time]"</strong> - Add a task to your calendar</span>
            </li>
            <li className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span><strong>"Move [task] to [time]"</strong> - Reschedule an existing task</span>
            </li>
            <li className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span><strong>"Mark [task] done"</strong> - Complete a task</span>
            </li>
            <li className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span><strong>"Clear my morning/afternoon"</strong> - Remove all items from time period</span>
            </li>
            <li className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span><strong>"What's next?"</strong> - See your next task or meeting</span>
            </li>
            <li className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span><strong>"Find 30 minutes for [task]"</strong> - Find available time slot</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
} 