/**
 * In-memory search engine implementation
 */

import type { 
  Document, 
  SearchResult, 
  SearchOptions, 
  ParsedQuery,
  MemoryAdapter,
  IndexConfig,
  FieldConfig,
  FacetRequest,
  SortField,
  FacetResult
} from '../types.js';
import type { EngineConfig, SearchMetrics } from './types.js';
import { DocumentIndexer } from '../index/indexer.js';
import { QueryParser } from '../query/parser.js';
import { createScorer } from '../query/scorer.js';
import { FacetProcessor } from '../facets/facet.js';
import { Autocompleter, SpellChecker, ContextAwareSuggester } from '../suggest/autocomplete.js';
import { createAnalyzer, STANDARD_ANALYZER } from '../index/analyzer.js';
import { SearchError } from '../types.js';

export class MemorySearchEngine {
  private readonly indexer: DocumentIndexer;
  private readonly parser: QueryParser;
  private readonly facetProcessor: FacetProcessor;
  private readonly config: EngineConfig;
  private readonly autocompleters: Map<string, Autocompleter> = new Map();
  private readonly spellCheckers: Map<string, SpellChecker> = new Map();

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = {
      defaultAnalyzer: 'standard',
      defaultScoring: 'bm25',
      k1: 1.2,
      b: 0.75,
      maxDocs: 10000,
      cacheSize: 1000,
      ...config
    };

    this.indexer = new DocumentIndexer();
    this.parser = new QueryParser();
    this.facetProcessor = new FacetProcessor();
  }

  /**
   * Create a new index
   */
  createIndex(indexId: string, config: IndexConfig = {}): void {
    const analyzer = config.analyzer || STANDARD_ANALYZER;
    const scorer = createScorer(
      config.scoring?.type || this.config.defaultScoring,
      config.scoring?.params
    );

    this.indexer.createIndex(indexId, {
      analyzer,
      scoring: scorer,
      fields: config.fields
    });
  }

  /**
   * Add a document to an index
   */
  addDocument(indexId: string, doc: Record<string, any>): void {
    if (!this.indexer.hasIndex(indexId)) {
      throw new SearchError(
        `Index '${indexId}' not found`,
        'INDEX_NOT_FOUND'
      );
    }

    const document: Document = {
      id: doc.id || this.generateId(),
      fields: new Map(Object.entries(doc))
    };

    this.indexer.addDocument(indexId, document);
    
    // Rebuild suggestions for the index
    this.rebuildSuggestions(indexId);
  }

  /**
   * Update a document in an index
   */
  updateDocument(indexId: string, doc: Record<string, any>): void {
    if (!doc.id) {
      throw new SearchError(
        'Document must have an id for update',
        'MISSING_DOCUMENT_ID'
      );
    }

    const document: Document = {
      id: doc.id,
      fields: new Map(Object.entries(doc))
    };

    this.indexer.updateDocument(indexId, document);
    this.rebuildSuggestions(indexId);
  }

  /**
   * Remove a document from an index
   */
  removeDocument(indexId: string, docId: string): void {
    this.indexer.removeDocument(indexId, docId);
    this.rebuildSuggestions(indexId);
  }

  /**
   * Search for documents
   */
  async search(
    indexId: string,
    query: string | ParsedQuery,
    options: SearchOptions = {}
  ): Promise<{
    results: SearchResult[];
    total: number;
    took: number;
    facets?: Map<string, FacetResult>;
    metrics?: SearchMetrics;
  }> {
    const startTime = Date.now();
    const index = this.indexer.getIndex(indexId);
    
    if (!index) {
      throw new SearchError(
        `Index '${indexId}' not found`,
        'INDEX_NOT_FOUND'
      );
    }

    // Parse query if needed
    const parsedQuery = typeof query === 'string' 
      ? this.parser.parse(query, '_all')
      : query;

    // Get all documents
    const allDocs = this.indexer.getAllDocuments(indexId);
    
    // Score documents
    const scoredResults: SearchResult[] = [];
    let docsExamined = 0;

    for (const doc of allDocs) {
      docsExamined++;
      const score = this.scoreDocument(parsedQuery, doc.id, index);
      
      if (score > 0) {
        scoredResults.push({
          docId: doc.id,
          score,
          explanation: options.explain ? this.explainScore(parsedQuery, doc.id, index) : undefined
        });
      }
    }

    // Apply filters
    let filteredResults = scoredResults;

    // Sort results
    if (options.sort && options.sort.length > 0) {
      filteredResults = this.applySorting(filteredResults, options.sort, allDocs);
    } else {
      // Default sort by score descending
      filteredResults.sort((a, b) => b.score - a.score);
    }

    // Apply pagination
    const from = options.from || 0;
    const size = options.size || 10;
    const paginatedResults = filteredResults.slice(from, from + size);

    // Process facets
    let facets: Map<string, FacetResult> | undefined;
    if (options.facets && options.facets.length > 0) {
      const facetDocIds = new Set(paginatedResults.map(r => r.docId));
      const facetDocuments = allDocs.filter(doc => facetDocIds.has(doc.id));
      facets = this.facetProcessor.processFacets(facetDocuments, options.facets, index);
    }

    const took = Date.now() - startTime;

    return {
      results: paginatedResults,
      total: filteredResults.length,
      took,
      facets,
      metrics: {
        queryTime: took,
        docsExamined,
        docsReturned: paginatedResults.length,
        termsSearched: this.countTerms(parsedQuery),
        scoringTime: took // Simplified
      }
    };
  }

  /**
   * Get autocomplete suggestions
   */
  suggest(
    indexId: string,
    prefix: string,
    field?: string,
    size: number = 10
  ): import('../suggest/autocomplete.js').Suggestion[] {
    const completer = this.autocompleters.get(indexId);
    if (!completer) {
      return [];
    }
    return completer.suggest(prefix, field, size);
  }

  /**
   * Get spelling suggestions
   */
  spellCheck(
    indexId: string,
    term: string,
    maxSuggestions: number = 5
  ): import('../suggest/autocomplete.js').Suggestion[] {
    const spellChecker = this.spellCheckers.get(indexId);
    if (!spellChecker) {
      return [];
    }
    return spellChecker.suggest(term, maxSuggestions);
  }

  /**
   * Get index statistics
   */
  getStats(indexId: string) {
    return this.indexer.getIndexStats(indexId);
  }

  /**
   * List all indices
   */
  listIndices(): string[] {
    return this.indexer.listIndices();
  }

  /**
   * Delete an index
   */
  deleteIndex(indexId: string): void {
    this.indexer.deleteIndex(indexId);
    this.autocompleters.delete(indexId);
    this.spellCheckers.delete(indexId);
  }

  /**
   * Bulk index documents
   */
  bulkIndex(indexId: string, documents: Record<string, any>[]): void {
    const docs: Document[] = documents.map(doc => ({
      id: doc.id || this.generateId(),
      fields: new Map(Object.entries(doc))
    }));

    this.indexer.bulkIndex(indexId, docs);
    this.rebuildSuggestions(indexId);
  }

  private scoreDocument(query: ParsedQuery, docId: string, index: import('../index/inverted-index.js').InvertedIndexManager): number {
    // This is a simplified scoring - in a real implementation, we'd use the configured scorer
    let score = 0;

    if (query.type === 'term' && query.term && query.term !== '*') {
      const tf = index.getTermFrequency(query.term, docId);
      if (tf > 0) {
        const df = index.getDocumentFrequency(query.term);
        const idf = Math.log((index.getStats().documentCount - df + 0.5) / (df + 0.5));
        score = tf * idf * (query.boost || 1);
      }
    } else if (query.type === 'boolean') {
      // Simplified boolean scoring
      let mustScore = 0;
      let shouldScore = 0;

      if (query.must) {
        for (const subQuery of query.must) {
          const subScore = this.scoreDocument(subQuery, docId, index);
          if (subScore === 0) return 0;
          mustScore += subScore;
        }
      }

      if (query.should) {
        for (const subQuery of query.should || []) {
          const subScore = this.scoreDocument(subQuery, docId, index);
          if (subScore > 0) shouldScore += subScore;
        }
      }

      score = mustScore + (shouldScore > 0 ? shouldScore / (query.should?.length || 1) : 0);
    }

    return score;
  }

  private explainScore(query: ParsedQuery, docId: string, index: import('../index/inverted-index.js').InvertedIndexManager): any {
    // Simplified explanation
    return {
      value: this.scoreDocument(query, docId, index),
      description: 'Score calculation',
      details: []
    };
  }

  private applySorting(
    results: SearchResult[],
    sortFields: SortField[],
    allDocs: Document[]
  ): SearchResult[] {
    // For simplicity, only handle score sorting
    // In a real implementation, we'd sort by the specified fields
    return results.sort((a, b) => b.score - a.score);
  }

  private countTerms(query: ParsedQuery): number {
    if (query.type === 'term' && query.term) return 1;
    if (query.type === 'phrase' && query.terms) return query.terms.length;
    if (query.type === 'boolean') {
      let count = 0;
      for (const sub of query.must || []) count += this.countTerms(sub);
      for (const sub of query.should || []) count += this.countTerms(sub);
      for (const sub of query.must_not || []) count += this.countTerms(sub);
      return count;
    }
    return 0;
  }

  private rebuildSuggestions(indexId: string): void {
    const index = this.indexer.getIndex(indexId);
    const documents = this.indexer.getAllDocuments(indexId);
    
    if (index && documents.length > 0) {
      const completer = new Autocompleter(index, STANDARD_ANALYZER);
      const spellChecker = new SpellChecker(index);
      
      // Get all text fields for suggestions
      const fields = ['title', 'name', 'content', 'description', 'text'];
      completer.buildSuggestions(documents, fields);
      
      this.autocompleters.set(indexId, completer);
      this.spellCheckers.set(indexId, spellChecker);
    }
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
