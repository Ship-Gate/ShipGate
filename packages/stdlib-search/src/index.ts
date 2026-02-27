/**
 * @packageDocumentation
 * @isl-lang/stdlib-search
 * In-memory full-text search engine with TF-IDF/BM25 scoring, faceting, and suggestions
 */

// Core types
export type {
  Document,
  FieldValue,
  Posting,
  PostingList,
  InvertedIndex,
  Tokenizer,
  Analyzer,
  TokenFilter,
  ScoringAlgorithm,
  FieldStats,
  ParsedQuery,
  SearchResult,
  ScoreExplanation,
  FacetResult,
  FacetBucket,
  Suggestion,
  SearchOptions,
  SortField,
  FacetRequest,
  RangeBucket,
  IndexConfig,
  FieldConfig,
  BM25Params,
  TFIDFParams,
  MemoryAdapter,
  IndexStats
} from './types.js';

export { SearchError } from './types.js';

// Engine types
export type {
  EngineConfig,
  IndexState,
  QueryContext,
  DocumentVector,
  TermVector,
  SearchMetrics
} from './engine/types.js';

// Tokenizers
export {
  StandardTokenizer,
  WhitespaceTokenizer,
  KeywordTokenizer,
  LetterTokenizer,
  NGramTokenizer,
  EdgeNGramTokenizer,
  PathTokenizer,
  PatternTokenizer,
  createTokenizer
} from './index/tokenizer.js';

// Analyzers and filters
export {
  LowercaseFilter,
  StopFilter,
  SynonymFilter,
  StemmerFilter,
  LengthFilter,
  DefaultAnalyzer,
  createAnalyzer,
  STANDARD_ANALYZER,
  KEYWORD_ANALYZER,
  SIMPLE_ANALYZER,
  STOP_ANALYZER
} from './index/analyzer.js';

// Index components
export { InvertedIndexManager } from './index/inverted-index.js';
export { DocumentIndexer } from './index/indexer.js';

// Query components
export { QueryParser } from './query/parser.js';
export { QueryBuilder, match, matchPhrase, wildcard, fuzzy, bool, range, exists, existsField } from './query/builder.js';
export { BM25Scorer, TFIDFScorer, TermFrequencyScorer, createScorer } from './query/scorer.js';

// Faceting
export { FacetProcessor, FacetFilter } from './facets/facet.js';

// Suggestions
export { Autocompleter, SpellChecker, ContextAwareSuggester } from './suggest/autocomplete.js';

// Memory engine
export { MemorySearchEngine } from './engine/memory.js';

// Convenience factory function
export function createSearchEngine(config?: Partial<import('./engine/types.js').EngineConfig>): import('./engine/memory.js').MemorySearchEngine {
  const { MemorySearchEngine } = require('./engine/memory.js');
  return new MemorySearchEngine(config);
}

// Default export
export default {
  MemorySearchEngine: require('./engine/memory.js').MemorySearchEngine,
  createSearchEngine,
  QueryBuilder: require('./query/builder.js').QueryBuilder,
  QueryParser: require('./query/parser.js').QueryParser,
  FacetProcessor: require('./facets/facet.js').FacetProcessor,
  Autocompleter: require('./suggest/autocomplete.js').Autocompleter,
  SpellChecker: require('./suggest/autocomplete.js').SpellChecker,
  InvertedIndexManager: require('./index/inverted-index.js').InvertedIndexManager,
  DocumentIndexer: require('./index/indexer.js').DocumentIndexer
};
