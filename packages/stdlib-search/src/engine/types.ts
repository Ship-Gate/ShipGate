/**
 * Engine-specific types and interfaces
 */

export interface EngineConfig {
  defaultAnalyzer: string;
  defaultScoring: 'bm25' | 'tfidf';
  bm25?: {
    k1: number;
    b: number;
  };
  maxDocs?: number;
  cacheSize?: number;
}

export interface IndexState {
  id: string;
  name: string;
  config: EngineConfig;
  stats: {
    documentCount: number;
    totalTerms: number;
    sizeInBytes: number;
    lastUpdated: Date;
  };
}

export interface QueryContext {
  index: string;
  analyzer: string;
  scoring: string;
  options: any;
}

export interface DocumentVector {
  docId: string;
  terms: Map<string, number>;
  norm: number;
}

export interface TermVector {
  term: string;
  idf: number;
}

export interface SearchMetrics {
  queryTime: number;
  docsExamined: number;
  docsReturned: number;
  termsSearched: number;
  scoringTime: number;
}
