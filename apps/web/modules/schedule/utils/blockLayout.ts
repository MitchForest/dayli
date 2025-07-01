/**
 * Block layout utilities for handling overlapping time blocks
 */

import type { TimeBlock } from '../types/schedule.types';

export interface LayoutBlock extends TimeBlock {
  column: number;
  totalColumns: number;
}

/**
 * Converts time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours = 0, minutes = 0] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Checks if two time blocks overlap
 */
function blocksOverlap(block1: TimeBlock, block2: TimeBlock): boolean {
  const start1 = timeToMinutes(block1.startTime);
  const end1 = timeToMinutes(block1.endTime);
  const start2 = timeToMinutes(block2.startTime);
  const end2 = timeToMinutes(block2.endTime);
  
  return start1 < end2 && end1 > start2;
}

/**
 * Groups overlapping blocks into clusters
 */
function findOverlapClusters(blocks: TimeBlock[]): TimeBlock[][] {
  const clusters: TimeBlock[][] = [];
  const processed = new Set<string>();
  
  for (const block of blocks) {
    if (processed.has(block.id)) continue;
    
    const cluster: TimeBlock[] = [block];
    processed.add(block.id);
    
    // Find all blocks that overlap with any block in the cluster
    let changed = true;
    while (changed) {
      changed = false;
      for (const otherBlock of blocks) {
        if (processed.has(otherBlock.id)) continue;
        
        // Check if this block overlaps with any block in the cluster
        const overlapsCluster = cluster.some(clusterBlock => 
          blocksOverlap(clusterBlock, otherBlock)
        );
        
        if (overlapsCluster) {
          cluster.push(otherBlock);
          processed.add(otherBlock.id);
          changed = true;
        }
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

/**
 * Assigns columns to blocks within a cluster to prevent overlaps
 */
function assignColumnsToCluster(cluster: TimeBlock[]): LayoutBlock[] {
  // Sort by start time, then by duration (longer blocks first)
  const sortedBlocks = [...cluster].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) return startDiff;
    
    const durationA = timeToMinutes(a.endTime) - timeToMinutes(a.startTime);
    const durationB = timeToMinutes(b.endTime) - timeToMinutes(b.startTime);
    return durationB - durationA;
  });
  
  const layoutBlocks: LayoutBlock[] = [];
  const columns: LayoutBlock[][] = [];
  
  for (const block of sortedBlocks) {
    // Find the first column where this block doesn't overlap
    let columnIndex = 0;
    let placed = false;
    
    while (!placed) {
      if (!columns[columnIndex]) {
        columns[columnIndex] = [];
      }
      
      // Check if block fits in this column
      const canFit = !columns[columnIndex]!.some(existingBlock => 
        blocksOverlap(block, existingBlock)
      );
      
      if (canFit) {
        const layoutBlock: LayoutBlock = {
          ...block,
          column: columnIndex,
          totalColumns: 1, // Will update after all blocks are placed
        };
        columns[columnIndex]!.push(layoutBlock);
        layoutBlocks.push(layoutBlock);
        placed = true;
      } else {
        columnIndex++;
      }
    }
  }
  
  // Update total columns for all blocks in the cluster
  const totalColumns = columns.length;
  layoutBlocks.forEach(block => {
    block.totalColumns = totalColumns;
  });
  
  return layoutBlocks;
}

/**
 * Main function to calculate layout for all blocks
 */
export function calculateBlockLayout(blocks: TimeBlock[]): LayoutBlock[] {
  if (blocks.length === 0) return [];
  
  // Filter out any blocks with missing required properties
  const validBlocks = blocks.filter(block => 
    block.id && block.startTime && block.endTime && block.type && block.title
  );
  
  // Find all overlap clusters
  const clusters = findOverlapClusters(validBlocks);
  
  // Process each cluster independently
  const layoutBlocks: LayoutBlock[] = [];
  
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      // Single block, no overlaps
      const block = cluster[0];
      layoutBlocks.push({
        ...block,
        column: 0,
        totalColumns: 1,
      } as LayoutBlock);
    } else {
      // Multiple overlapping blocks
      const clusterLayout = assignColumnsToCluster(cluster);
      layoutBlocks.push(...clusterLayout);
    }
  }
  
  return layoutBlocks;
}

/**
 * Calculate CSS properties for a layout block
 */
export function getBlockLayoutStyle(
  block: LayoutBlock,
  containerWidth: number,
  padding: number = 4
): {
  left: string;
  width: string;
} {
  // Reduce padding for multiple columns
  const adjustedPadding = block.totalColumns > 2 ? 2 : padding;
  const gap = block.totalColumns > 2 ? 2 : 4;
  
  const availableWidth = containerWidth - (adjustedPadding * 2);
  const totalGaps = gap * (block.totalColumns - 1);
  const columnWidth = (availableWidth - totalGaps) / block.totalColumns;
  
  return {
    left: `${adjustedPadding + (block.column * (columnWidth + gap))}px`,
    width: `${columnWidth}px`,
  };
} 