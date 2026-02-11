/**
 * Inverted index implementation for efficient full-text search
 */

import type { 
  Document, 
  InvertedIndex, 
  Posting, 
  PostingList, 
  Analyzer,
  FieldConfig 
} from '../types.js';

export class InvertedIndexManager {
  private index: InvertedIndex;
  private analyzer: Analyzer;
  private fieldConfigs: Map<string, FieldConfig>;

  constructor(analyzer: Analyzer, fieldConfigs: FieldConfig[] = []) {
    this.index = {
      postings: new Map(),
      documentCount: 0,
      totalTerms: 0,
      avgFieldLength: new Map(),
      fieldLengths: new Map()
    };
    this.analyzer = analyzer;
    this.fieldConfigs = new Map();
    
    for (const config of fieldConfigs) {
      this.fieldConfigs.set(config.name, config);
    }
  }

  /**
   * Add a document to the index
   */
  addDocument(document: Document): void {
    const docId = document.id;
    
    // Remove existing document if it exists
    this.removeDocument(docId);
    
    this.index.documentCount++;
    
    // Process each field
    for (const [fieldName, fieldValue] of document.fields.entries()) {
      const config = this.fieldConfigs.get(fieldName);
      
      // Skip if field is not indexed
      if (config && !config.indexed) {
        continue;
      }
      
      // Only index text fields
      if (typeof fieldValue === 'string') {
        this.indexField(docId, fieldName, fieldValue);
      }
    }
    
    this.updateStatistics();
  }

  /**
   * Remove a document from the index
   */
  removeDocument(docId: string): void {
    const termsToRemove: string[] = [];
    
    for (const [term, postingList] of this.index.postings.entries()) {
      if (postingList.postings.has(docId)) {
        postingList.postings.delete(docId);
        postingList.documentFrequency--;
        
        if (postingList.postings.size === 0) {
          termsToRemove.push(term);
        }
      }
    }
    
    // Remove empty posting lists
    for (const term of termsToRemove) {
      this.index.postings.delete(term);
    }
    
    // Remove field lengths
    for (const fieldLengths of this.index.fieldLengths.values()) {
      fieldLengths.delete(docId);
    }
    
    this.index.documentCount = Math.max(0, this.index.documentCount - 1);
    this.updateStatistics();
  }

  /**
   * Update a document in the index
   */
  updateDocument(document: Document): void {
    this.addDocument(document);
  }

  /**
   * Get documents containing a term
   */
  getDocumentsForTerm(term: string): Map<string, Posting> {
    const postingList = this.index.postings.get(term);
    return postingList ? postingList.postings : new Map();
  }

  /**
   * Get posting list for a term
   */
  getPostingList(term: string): PostingList | undefined {
    return this.index.postings.get(term);
  }

  /**
   * Get all terms in the index
   */
  getAllTerms(): string[] {
    return Array.from(this.index.postings.keys());
  }

  /**
   * Get document frequency for a term
   */
  getDocumentFrequency(term: string): number {
    const postingList = this.index.postings.get(term);
    return postingList ? postingList.documentFrequency : 0;
  }

  /**
   * Get term frequency for a term in a document
   */
  getTermFrequency(term: string, docId: string): number {
    const posting = this.getDocumentsForTerm(term).get(docId);
    return posting ? posting.termFrequency : 0;
  }

  /**
   * Get field length for a document
   */
  getFieldLength(fieldName: string, docId: string): number {
    const fieldLengths = this.index.fieldLengths.get(fieldName);
    return fieldLengths ? fieldLengths.get(docId) || 0 : 0;
  }

  /**
   * Get average field length
   */
  getAverageFieldLength(fieldName: string): number {
    return this.index.avgFieldLength.get(fieldName) || 0;
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      documentCount: this.index.documentCount,
      totalTerms: this.index.totalTerms,
      uniqueTerms: this.index.postings.size,
      avgFieldLength: new Map(this.index.avgFieldLength)
    };
  }

  /**
   * Get the raw inverted index (for advanced use cases)
   */
  getRawIndex(): InvertedIndex {
    return this.index;
  }

  /**
   * Clear the entire index
   */
  clear(): void {
    this.index.postings.clear();
    this.index.documentCount = 0;
    this.index.totalTerms = 0;
    this.index.avgFieldLength.clear();
    this.index.fieldLengths.clear();
  }

  /**
   * Merge another index into this one
   */
  merge(other: InvertedIndexManager): void {
    for (const [term, otherPostingList] of other.index.postings.entries()) {
      const postingList = this.index.postings.get(term);
      
      if (!postingList) {
        this.index.postings.set(term, {
          term,
          postings: new Map(otherPostingList.postings),
          documentFrequency: otherPostingList.documentFrequency
        });
      } else {
        // Merge posting lists
        for (const [docId, posting] of otherPostingList.postings.entries()) {
          const existingPosting = postingList.postings.get(docId);
          
          if (!existingPosting) {
            postingList.postings.set(docId, { ...posting });
            postingList.documentFrequency++;
          } else {
            // Combine term frequencies
            existingPosting.termFrequency += posting.termFrequency;
            if (posting.positions) {
              existingPosting.positions = existingPosting.positions || [];
              existingPosting.positions.push(...posting.positions);
            }
          }
        }
      }
    }
    
    this.updateStatistics();
  }

  private indexField(docId: string, fieldName: string, fieldValue: string): void {
    const tokens = this.analyzer.analyze(fieldValue);
    
    // Track field length
    if (!this.index.fieldLengths.has(fieldName)) {
      this.index.fieldLengths.set(fieldName, new Map());
    }
    this.index.fieldLengths.get(fieldName)!.set(docId, tokens.length);
    
    // Index each token
    const termCounts = new Map<string, number>();
    const termPositions = new Map<string, number[]>();
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
      
      if (!termPositions.has(token)) {
        termPositions.set(token, []);
      }
      termPositions.get(token)!.push(i);
    }
    
    // Update posting lists
    for (const [term, count] of termCounts.entries()) {
      let postingList = this.index.postings.get(term);
      
      if (!postingList) {
        postingList = {
          term,
          postings: new Map(),
          documentFrequency: 0
        };
        this.index.postings.set(term, postingList);
      }
      
      // Add posting if not exists
      if (!postingList.postings.has(docId)) {
        postingList.postings.set(docId, {
          docId,
          termFrequency: count,
          positions: termPositions.get(term)
        });
        postingList.documentFrequency++;
        this.index.totalTerms++;
      } else {
        // Update existing posting
        const posting = postingList.postings.get(docId)!;
        posting.termFrequency += count;
        if (termPositions.has(term)) {
          posting.positions = posting.positions || [];
          posting.positions.push(...termPositions.get(term)!);
        }
      }
    }
  }

  private updateStatistics(): void {
    // Update average field lengths
    for (const [fieldName, fieldLengths] of this.index.fieldLengths.entries()) {
      if (fieldLengths.size > 0) {
        const totalLength = Array.from(fieldLengths.values()).reduce((sum, len) => sum + len, 0);
        const avgLength = totalLength / fieldLengths.size;
        this.index.avgFieldLength.set(fieldName, avgLength);
      }
    }
  }
}
