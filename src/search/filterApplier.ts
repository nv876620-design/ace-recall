/**
 * Filter Applier for Field-Qualified Search
 * 
 * Applies parsed query filters to search results
 */

import type { Chunk } from '../db/index.js';
import type { ParsedQuery } from './queryParser.js';

export interface FilterableChunk extends Chunk {
  language?: string;
  kind?: string; // From breadcrumb if available
  symbolName?: string; // Extracted from breadcrumb
}

/**
 * Apply query filters to chunks
 */
export function applyFilters(
  chunks: FilterableChunk[],
  filters: ParsedQuery['filters'],
): FilterableChunk[] {
  if (Object.keys(filters).length === 0) {
    return chunks;
  }
  
  return chunks.filter(chunk => {
    // Filter by kind (function, class, method, etc.)
    if (filters.kind && filters.kind.length > 0) {
      if (!chunk.kind) return false;
      const kindLower = chunk.kind.toLowerCase();
      if (!filters.kind.some(k => kindLower.includes(k.toLowerCase()))) {
        return false;
      }
    }
    
    // Filter by language
    if (filters.lang && filters.lang.length > 0) {
      if (!chunk.language) return false;
      const langLower = chunk.language.toLowerCase();
      if (!filters.lang.some(l => langLower === l.toLowerCase())) {
        return false;
      }
    }
    
    // Filter by path pattern
    if (filters.path && filters.path.length > 0) {
      if (!chunk.file_path) return false;
      const pathLower = chunk.file_path.toLowerCase();
      if (!filters.path.some(p => pathLower.includes(p.toLowerCase()))) {
        return false;
      }
    }
    
    // Filter by name pattern
    if (filters.name && filters.name.length > 0) {
      // Check both symbol name and breadcrumb
      const symbolName = chunk.symbolName || chunk.breadcrumb || '';
      const nameLower = symbolName.toLowerCase();
      if (!filters.name.some(n => nameLower.includes(n.toLowerCase()))) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Extract metadata from chunk for filtering
 */
export function enrichChunkMetadata(chunk: Chunk): FilterableChunk {
  const enriched: FilterableChunk = { ...chunk };
  
  // Extract kind from breadcrumb
  // Examples: "class UserAuth", "function handleLogin", "method validate"
  if (chunk.breadcrumb) {
    const kindMatch = chunk.breadcrumb.match(/^(class|function|method|interface|type|const|enum)\s+(\w+)/i);
    if (kindMatch) {
      enriched.kind = kindMatch[1].toLowerCase();
      enriched.symbolName = kindMatch[2];
    } else {
      // Try to extract symbol name after :: or .
      const symbolMatch = chunk.breadcrumb.match(/[:.](\w+)$/);
      if (symbolMatch) {
        enriched.symbolName = symbolMatch[1];
      }
    }
  }
  
  return enriched;
}
