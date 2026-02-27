/**
 * Core types and interfaces for the in-memory search engine
 */

export interface Document {
  id: string;
  fields: Map<string, FieldValue>;
}

export type FieldValue = string | number | boolean | Date | null | undefined;

export interface Posting {
  docId: string;
  termFrequency: number;
  positions?: number[];
  payload?: any;
}

export interface PostingList {
  term: string;
  postings: Map<string, Posting>;
  documentFrequency: number;
}

export interface InvertedIndex {
  postings: Map<string, PostingList>;
  documentCount: number;
  totalTerms: number;
  avgFieldLength: Map<string, number>;
  fieldLengths: Map<string, Map<string, number>>;
}

export interface Tokenizer {
  tokenize(text: string): string[];
}

export interface Analyzer {
  name: string;
  tokenizer: Tokenizer;
  filters: TokenFilter[];
}

export interface TokenFilter {
  name: string;
  filter(tokens: string[]): string[];
}

export interface ScoringAlgorithm {
  score(
    query: ParsedQuery,
    docId: string,
    index: InvertedIndex,
    fieldStats?: FieldStats
  ): number;
}

export interface FieldStats {
  field: string;
  avgLength: number;
  totalDocs: number;
}

export interface ParsedQuery {
  type: 'term' | 'phrase' | 'boolean' | 'wildcard' | 'fuzzy';
  term?: string;
  terms?: string[];
  field?: string;
  operator?: 'AND' | 'OR' | 'NOT';
  queries?: ParsedQuery[];
  must?: ParsedQuery[];
  should?: ParsedQuery[];
  must_not?: ParsedQuery[];
  boost?: number;
  fuzziness?: number;
  prefix?: string;
  suffix?: string;
}

export interface SearchResult {
  docId: string;
  score: number;
  explanation?: ScoreExplanation;
}

export interface ScoreExplanation {
  value: number;
  description: string;
  details: ScoreExplanation[];
}

export interface FacetResult {
  field: string;
  buckets: FacetBucket[];
}

export interface FacetBucket {
  key: string;
  count: number;
  from?: number;
  to?: number;
}

export interface Suggestion {
  text: string;
  score: number;
  highlight?: string;
}

export interface SearchOptions {
  from?: number;
  size?: number;
  sort?: SortField[];
  facets?: FacetRequest[];
  explain?: boolean;
}

export interface SortField {
  field: string;
  order: 'asc' | 'desc';
  mode?: 'min' | 'max' | 'sum' | 'avg';
}

export interface FacetRequest {
  field: string;
  type: 'terms' | 'range' | 'date_histogram' | 'histogram';
  size?: number;
  ranges?: RangeBucket[];
  interval?: number;
  format?: string;
}

export interface RangeBucket {
  key?: string;
  from?: number;
  to?: number;
}

export interface IndexConfig {
  analyzer?: Analyzer;
  scoring?: ScoringAlgorithm;
  fields?: FieldConfig[];
}

export interface FieldConfig {
  name: string;
  type: 'text' | 'keyword' | 'number' | 'date' | 'boolean';
  analyzer?: string;
  indexed?: boolean;
  stored?: boolean;
  facetable?: boolean;
  sortable?: boolean;
}

// BM25 parameters
export interface BM25Params {
  k1: number;
  b: number;
}

// TF-IDF parameters
export interface TFIDFParams {
  useIdf: boolean;
  useNorm: boolean;
}

// Error types
export class SearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

// Memory adapter interface
export interface MemoryAdapter {
  addDocument(doc: Document): void;
  removeDocument(docId: string): void;
  updateDocument(doc: Document): void;
  getDocument(docId: string): Document | undefined;
  getAllDocuments(): Document[];
  getDocumentCount(): number;
}

// Index statistics
export interface IndexStats {
  documentCount: number;
  totalTerms: number;
  avgFieldLength: Map<string, number>;
  fieldStats: Map<string, FieldStats>;
}
