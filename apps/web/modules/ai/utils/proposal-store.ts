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

interface StoredProposal {
  proposalId: string;
  workflowType: string;
  date?: string;
  blockId?: string;
  data: any;
  timestamp: Date;
  userId?: string;
}

export class ProposalStore {
  private static instance: ProposalStore;
  private proposals = new Map<string, StoredProposal>();
  private proposalsByKey = new Map<string, string>(); // composite key -> proposalId
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
    proposalId: string,
    workflowType: string,
    data: any,
    metadata?: { date?: string; blockId?: string; userId?: string }
  ): void {
    const proposal: StoredProposal = {
      proposalId,
      workflowType,
      date: metadata?.date,
      blockId: metadata?.blockId,
      data,
      timestamp: new Date(),
      userId: metadata?.userId
    };
    
    this.proposals.set(proposalId, proposal);
    
    // Create composite keys for easier lookup
    if (metadata?.date) {
      const dateKey = `${workflowType}:${metadata.date}`;
      this.proposalsByKey.set(dateKey, proposalId);
    }
    
    if (metadata?.blockId) {
      const blockKey = `${workflowType}:block:${metadata.blockId}`;
      this.proposalsByKey.set(blockKey, proposalId);
    }
    
    // Clean up old proposals (older than 10 minutes)
    this.cleanup();
  }
  
  /**
   * Retrieve a proposal by ID
   */
  get(proposalId: string): StoredProposal | null {
    return this.proposals.get(proposalId) || null;
  }
  
  /**
   * Find a proposal by workflow and date
   */
  findByWorkflowAndDate(workflowType: string, date: string): StoredProposal | null {
    const key = `${workflowType}:${date}`;
    const proposalId = this.proposalsByKey.get(key);
    return proposalId ? this.get(proposalId) : null;
  }
  
  /**
   * Find a proposal by workflow and block
   */
  findByWorkflowAndBlock(workflowType: string, blockId: string): StoredProposal | null {
    const key = `${workflowType}:block:${blockId}`;
    const proposalId = this.proposalsByKey.get(key);
    return proposalId ? this.get(proposalId) : null;
  }
  
  /**
   * Get the latest proposal by workflow
   */
  getLatestByWorkflow(workflowType: string): StoredProposal | null {
    let latest: StoredProposal | null = null;
    
    for (const proposal of this.proposals.values()) {
      if (proposal.workflowType === workflowType) {
        if (!latest || proposal.timestamp > latest.timestamp) {
          latest = proposal;
        }
      }
    }
    
    return latest;
  }
  
  /**
   * Delete a proposal
   */
  delete(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (proposal) {
      this.proposals.delete(proposalId);
      
      // Remove composite keys
      if (proposal.date) {
        const dateKey = `${proposal.workflowType}:${proposal.date}`;
        this.proposalsByKey.delete(dateKey);
      }
      
      if (proposal.blockId) {
        const blockKey = `${proposal.workflowType}:block:${proposal.blockId}`;
        this.proposalsByKey.delete(blockKey);
      }
    }
  }
  
  /**
   * Clean up expired proposals
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [proposalId, proposal] of this.proposals.entries()) {
      if (now - proposal.timestamp.getTime() > maxAge) {
        this.delete(proposalId);
      }
    }
  }
  
  /**
   * Clear all proposals
   */
  clear(): void {
    this.proposals.clear();
    this.proposalsByKey.clear();
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
   * Destroy the store and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }
}

// Export singleton instance
export const proposalStore = ProposalStore.getInstance(); 