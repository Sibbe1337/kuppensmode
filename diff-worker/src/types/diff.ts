export interface SemanticDiffResult {
  itemType: string;
  name: string;
  changeType: string;
  similarityScore?: number;
}

export type ChangedItemDetail = SemanticDiffResult; 