/**
 * Types for ISL cache layer
 */

export interface ISLSpecCacheEntry {
  promptHash: string;
  islSpec: string;
  parsedAST: unknown;
  timestamp: number;
  modelUsed: string;
}

export interface CacheStats {
  hit: boolean;
  stage: string;
  savedMs?: number;
  savedTokens?: number;
  message: string;
}

export interface ISLConstructDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface IncrementalDiffResult {
  entities: ISLConstructDiff;
  behaviors: ISLConstructDiff;
  endpoints: ISLConstructDiff;
  hasChanges: boolean;
}
