// src/types/diff.ts

// Define HashManifestEntry structure (as used by snapshot-worker and diff APIs)
export interface HashManifestEntry {
  hash: string;
  type: 'page' | 'database' | 'block';
  name?: string; 
  blockType?: string; 
  parentId?: string; 
  hasTitleEmbedding?: boolean;
  hasDescriptionEmbedding?: boolean;
  totalChunks?: number;
}

// Define the type for a single changed item detail (used in SemanticDiffResult)
export type ChangedItemDetail = {
  id: string;
  name?: string;
  itemType?: string; // page, database, block
  blockType?: string;
  changeType: 'hash_only_similar' | 'semantic_divergence' | 'pending_semantic_check' | 'no_embeddings_found' | 'structural_change' | 'error_in_processing';
  similarityScore?: number;
};

// Main result structure for a semantic diff operation
export interface SemanticDiffResult {
  diffJobId?: string; // Populated by the worker or API
  userId?: string;
  snapshotIdFrom: string;
  snapshotIdTo: string;
  status?: 'processing' | 'completed' | 'error' | 'pending' | 'not_found';
  summary: {
    added: number;
    deleted: number;
    contentHashChanged: number;    // Total items with hash differences
    semanticallySimilar: number;   // Hash changed, but content is semantically similar
    semanticallyChanged: number;   // Hash changed, and content is semantically different
    // Could add items_pending_semantic_check here if needed
  };
  details?: {
    addedItems: { id: string; name?: string; type?: string; blockType?: string }[];
    deletedItems: { id: string; name?: string; type?: string; blockType?: string }[];
    changedItems: ChangedItemDetail[];
  };
  llmSummary?: string;          // New: LLM-generated summary
  llmModel?: string;            // New: Model used for summary
  llmTokens?: number;           // New: Tokens used for summary
  error?: string;
  message?: string;
  createdAt?: string | object; // ISO string or Firestore Timestamp
  updatedAt?: string | object; // ISO string or Firestore Timestamp
  viewDetailsUrl?: string; // Optional: direct link to a detailed view for this specific diff
} 