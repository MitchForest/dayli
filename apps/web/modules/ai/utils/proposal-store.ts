import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Schema for a proposal
const proposalSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string(),
  data: z.any(),
  createdAt: z.date(),
  expiresAt: z.date(),
  metadata: z.record(z.any()).optional(),
});

export type Proposal = z.infer<typeof proposalSchema>;

interface ProposalStoreOptions {
  ttlMinutes?: number; // Time to live in minutes
  maxSize?: number; // Maximum number of proposals to store
}

export class ProposalStore {
  private static instance: ProposalStore;
  private proposals = new Map<string, Proposal>();
  private cleanupInterval?: NodeJS.Timeout;
  private options: Required<ProposalStoreOptions>;
  
  static getInstance(): ProposalStore {
    if (!ProposalStore.instance) {
      ProposalStore.instance = new ProposalStore();
    }
    return ProposalStore.instance;
  }
  
  constructor(options: ProposalStoreOptions = {}) {
    this.options = {
      ttlMinutes: options.ttlMinutes ?? 5, // 5 minutes default
      maxSize: options.maxSize ?? 100, // 100 proposals max
    };
    
    // Start cleanup routine
    this.startCleanupRoutine();
  }
  
  /**
   * Store a proposal
   */
  store(
    type: string,
    description: string,
    data: any,
    metadata?: Record<string, any>
  ): string {
    // Clean up if we're at max size
    if (this.proposals.size >= this.options.maxSize) {
      this.cleanupOldest();
    }
    
    const id = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.options.ttlMinutes * 60 * 1000);
    
    const proposal: Proposal = {
      id,
      type,
      description,
      data,
      createdAt: now,
      expiresAt,
      metadata,
    };
    
    this.proposals.set(id, proposal);
    
    console.log(`[ProposalStore] Stored proposal ${id} of type ${type}`);
    return id;
  }
  
  /**
   * Retrieve a proposal by ID
   */
  get(id: string): Proposal | null {
    const proposal = this.proposals.get(id);
    
    if (!proposal) {
      return null;
    }
    
    // Check if expired
    if (proposal.expiresAt < new Date()) {
      this.proposals.delete(id);
      console.log(`[ProposalStore] Proposal ${id} has expired`);
      return null;
    }
    
    return proposal;
  }
  
  /**
   * Execute and remove a proposal
   */
  consume(id: string): Proposal | null {
    const proposal = this.get(id);
    
    if (proposal) {
      this.proposals.delete(id);
      console.log(`[ProposalStore] Consumed proposal ${id}`);
    }
    
    return proposal;
  }
  
  /**
   * Delete a proposal
   */
  delete(id: string): boolean {
    const deleted = this.proposals.delete(id);
    if (deleted) {
      console.log(`[ProposalStore] Deleted proposal ${id}`);
    }
    return deleted;
  }
  
  /**
   * List all active proposals
   */
  list(): Proposal[] {
    const now = new Date();
    const active: Proposal[] = [];
    
    // Clean up expired while listing
    for (const [id, proposal] of this.proposals.entries()) {
      if (proposal.expiresAt < now) {
        this.proposals.delete(id);
      } else {
        active.push(proposal);
      }
    }
    
    return active;
  }
  
  /**
   * Clear all proposals
   */
  clear(): void {
    const size = this.proposals.size;
    this.proposals.clear();
    console.log(`[ProposalStore] Cleared ${size} proposals`);
  }
  
  /**
   * Get store size
   */
  size(): number {
    return this.proposals.size;
  }
  
  /**
   * Clean up expired proposals
   */
  private cleanup(): void {
    const now = new Date();
    let cleaned = 0;
    
    for (const [id, proposal] of this.proposals.entries()) {
      if (proposal.expiresAt < now) {
        this.proposals.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[ProposalStore] Cleaned up ${cleaned} expired proposals`);
    }
  }
  
  /**
   * Clean up oldest proposals when at max size
   */
  private cleanupOldest(): void {
    // Sort by creation date and remove oldest 10%
    const sorted = Array.from(this.proposals.entries())
      .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
    
    const toRemove = Math.ceil(sorted.length * 0.1);
    
    for (let i = 0; i < toRemove; i++) {
      const entry = sorted[i];
      if (entry) {
        const [id] = entry;
        this.proposals.delete(id);
      }
    }
    
    console.log(`[ProposalStore] Removed ${toRemove} oldest proposals`);
  }
  
  /**
   * Start automatic cleanup routine
   */
  private startCleanupRoutine(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // 1 minute
  }
  
  /**
   * Stop cleanup routine
   */
  stopCleanupRoutine(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  
  /**
   * Create a confirmation proposal
   */
  createConfirmation(
    action: string,
    details: any,
    consequences?: string[]
  ): string {
    return this.store(
      'confirmation',
      action,
      details,
      { consequences }
    );
  }
  
  /**
   * Create a multi-choice proposal
   */
  createChoice(
    question: string,
    options: Array<{ id: string; label: string; data: any }>,
    context?: any
  ): string {
    return this.store(
      'choice',
      question,
      { options, context }
    );
  }
}

// Export singleton instance
export const proposalStore = ProposalStore.getInstance(); 