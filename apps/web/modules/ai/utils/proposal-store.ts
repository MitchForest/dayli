/**
 * Proposal Store
 * 
 * Manages workflow proposals between chat messages to maintain context
 */

import { v4 as uuidv4 } from 'uuid';

export interface Proposal {
  id: string;
  type: 'schedule' | 'tasks' | 'emails';
  workflowType: string;
  date: string;
  data: any;
  createdAt: Date;
  expiresAt: Date;
  userId: string;
}

class ProposalStore {
  private proposals: Map<string, Proposal> = new Map();
  private readonly TTL_MINUTES = 10; // Proposals expire after 10 minutes

  /**
   * Save a new proposal
   */
  saveProposal(
    userId: string,
    type: 'schedule' | 'tasks' | 'emails',
    workflowType: string,
    date: string,
    data: any
  ): string {
    // Clear expired proposals first
    this.clearExpired();

    const id = uuidv4();
    const now = new Date();
    const proposal: Proposal = {
      id,
      type,
      workflowType,
      date,
      data,
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.TTL_MINUTES * 60 * 1000),
    };

    this.proposals.set(id, proposal);
    console.log('[ProposalStore] Saved proposal:', { id, type, date, workflowType });
    
    return id;
  }

  /**
   * Get a proposal by ID
   */
  getProposal(id: string): Proposal | null {
    this.clearExpired();
    const proposal = this.proposals.get(id);
    
    if (!proposal) {
      console.log('[ProposalStore] Proposal not found:', id);
      return null;
    }

    return proposal;
  }

  /**
   * Get the latest proposal for a workflow type and optional date
   */
  getLatestProposal(
    userId: string,
    workflowType: string,
    date?: string
  ): Proposal | null {
    this.clearExpired();

    let latestProposal: Proposal | null = null;
    let latestTime = 0;

    for (const proposal of this.proposals.values()) {
      // Match user, workflow type, and optionally date
      if (proposal.userId === userId && 
          proposal.workflowType === workflowType &&
          (!date || proposal.date === date)) {
        const proposalTime = proposal.createdAt.getTime();
        if (proposalTime > latestTime) {
          latestTime = proposalTime;
          latestProposal = proposal;
        }
      }
    }

    if (latestProposal) {
      console.log('[ProposalStore] Found latest proposal:', {
        id: latestProposal.id,
        type: latestProposal.type,
        date: latestProposal.date
      });
    } else {
      console.log('[ProposalStore] No proposal found for:', { userId, workflowType, date });
    }

    return latestProposal;
  }

  /**
   * Get recent proposals for a user
   */
  getRecentProposals(userId: string, limit: number = 5): Proposal[] {
    this.clearExpired();

    const userProposals = Array.from(this.proposals.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return userProposals;
  }

  /**
   * Clear a specific proposal
   */
  clearProposal(id: string): void {
    this.proposals.delete(id);
    console.log('[ProposalStore] Cleared proposal:', id);
  }

  /**
   * Clear expired proposals
   */
  private clearExpired(): void {
    const now = new Date();
    let cleared = 0;

    for (const [id, proposal] of this.proposals.entries()) {
      if (proposal.expiresAt < now) {
        this.proposals.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log('[ProposalStore] Cleared expired proposals:', cleared);
    }
  }

  /**
   * Clear all proposals for a user
   */
  clearUserProposals(userId: string): void {
    let cleared = 0;
    for (const [id, proposal] of this.proposals.entries()) {
      if (proposal.userId === userId) {
        this.proposals.delete(id);
        cleared++;
      }
    }
    console.log('[ProposalStore] Cleared user proposals:', { userId, count: cleared });
  }

  /**
   * Get store stats
   */
  getStats(): { total: number; byType: Record<string, number> } {
    this.clearExpired();
    
    const byType: Record<string, number> = {};
    for (const proposal of this.proposals.values()) {
      byType[proposal.type] = (byType[proposal.type] || 0) + 1;
    }

    return {
      total: this.proposals.size,
      byType,
    };
  }
}

// Export singleton instance
export const proposalStore = new ProposalStore(); 