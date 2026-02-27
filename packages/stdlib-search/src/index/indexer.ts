/**
 * Document indexer implementation
 */

import type { Document, FieldValue, IndexConfig, FieldConfig } from '../types.js';
import { InvertedIndexManager } from './inverted-index.js';
import { createAnalyzer, STANDARD_ANALYZER } from './analyzer.js';

export class DocumentIndexer {
  private indices: Map<string, InvertedIndexManager> = new Map();
  private documents: Map<string, Map<string, Document>> = new Map(); // indexId -> docId -> Document
  private configs: Map<string, IndexConfig> = new Map();

  /**
   * Create a new index
   */
  createIndex(indexId: string, config: IndexConfig = {}): void {
    if (this.indices.has(indexId)) {
      throw new Error(`Index '${indexId}' already exists`);
    }

    const analyzer = config.analyzer || STANDARD_ANALYZER;
    const indexManager = new InvertedIndexManager(analyzer, config.fields);
    
    this.indices.set(indexId, indexManager);
    this.documents.set(indexId, new Map());
    this.configs.set(indexId, config);
  }

  /**
   * Delete an index
   */
  deleteIndex(indexId: string): void {
    this.indices.delete(indexId);
    this.documents.delete(indexId);
    this.configs.delete(indexId);
  }

  /**
   * Add a document to an index
   */
  addDocument(indexId: string, document: Document): void {
    const index = this.indices.get(indexId);
    const docs = this.documents.get(indexId);
    
    if (!index || !docs) {
      throw new Error(`Index '${indexId}' not found`);
    }

    // Convert raw values to proper field values
    const processedDoc = this.processDocument(document);
    
    index.addDocument(processedDoc);
    docs.set(document.id, processedDoc);
  }

  /**
   * Remove a document from an index
   */
  removeDocument(indexId: string, docId: string): void {
    const index = this.indices.get(indexId);
    const docs = this.documents.get(indexId);
    
    if (!index || !docs) {
      throw new Error(`Index '${indexId}' not found`);
    }

    index.removeDocument(docId);
    docs.delete(docId);
  }

  /**
   * Update a document in an index
   */
  updateDocument(indexId: string, document: Document): void {
    const index = this.indices.get(indexId);
    const docs = this.documents.get(indexId);
    
    if (!index || !docs) {
      throw new Error(`Index '${indexId}' not found`);
    }

    // Remove old version if exists
    if (docs.has(document.id)) {
      index.removeDocument(document.id);
    }

    // Add new version
    const processedDoc = this.processDocument(document);
    index.addDocument(processedDoc);
    docs.set(document.id, processedDoc);
  }

  /**
   * Get a document from an index
   */
  getDocument(indexId: string, docId: string): Document | undefined {
    const docs = this.documents.get(indexId);
    return docs ? docs.get(docId) : undefined;
  }

  /**
   * Get all documents in an index
   */
  getAllDocuments(indexId: string): Document[] {
    const docs = this.documents.get(indexId);
    return docs ? Array.from(docs.values()) : [];
  }

  /**
   * Get document count for an index
   */
  getDocumentCount(indexId: string): number {
    const docs = this.documents.get(indexId);
    return docs ? docs.size : 0;
  }

  /**
   * Get index manager for an index
   */
  getIndex(indexId: string): InvertedIndexManager | undefined {
    return this.indices.get(indexId);
  }

  /**
   * Get index statistics
   */
  getIndexStats(indexId: string) {
    const index = this.indices.get(indexId);
    const docs = this.documents.get(indexId);
    const config = this.configs.get(indexId);
    
    if (!index || !docs) {
      return null;
    }

    return {
      indexId,
      documentCount: docs.size,
      ...index.getStats(),
      config
    };
  }

  /**
   * Bulk index documents
   */
  bulkIndex(indexId: string, documents: Document[]): void {
    const index = this.indices.get(indexId);
    const docs = this.documents.get(indexId);
    
    if (!index || !docs) {
      throw new Error(`Index '${indexId}' not found`);
    }

    for (const document of documents) {
      const processedDoc = this.processDocument(document);
      index.addDocument(processedDoc);
      docs.set(document.id, processedDoc);
    }
  }

  /**
   * Bulk delete documents
   */
  bulkDelete(indexId: string, docIds: string[]): void {
    const index = this.indices.get(indexId);
    const docs = this.documents.get(indexId);
    
    if (!index || !docs) {
      throw new Error(`Index '${indexId}' not found`);
    }

    for (const docId of docIds) {
      index.removeDocument(docId);
      docs.delete(docId);
    }
  }

  /**
   * List all indices
   */
  listIndices(): string[] {
    return Array.from(this.indices.keys());
  }

  /**
   * Check if an index exists
   */
  hasIndex(indexId: string): boolean {
    return this.indices.has(indexId);
  }

  /**
   * Clear all data in an index
   */
  clearIndex(indexId: string): void {
    const index = this.indices.get(indexId);
    const docs = this.documents.get(indexId);
    
    if (!index || !docs) {
      throw new Error(`Index '${indexId}' not found`);
    }

    index.clear();
    docs.clear();
  }

  /**
   * Optimize an index (merge segments, etc.)
   */
  optimizeIndex(indexId: string): void {
    // In-memory index doesn't need optimization like disk-based indexes
    // This is a placeholder for future optimizations
  }

  private processDocument(document: Document): Document {
    const processedFields = new Map<string, FieldValue>();
    
    for (const [fieldName, value] of document.fields.entries()) {
      processedFields.set(fieldName, this.processFieldValue(value));
    }
    
    return {
      id: document.id,
      fields: processedFields
    };
  }

  private processFieldValue(value: FieldValue): FieldValue {
    if (value === null || value === undefined) {
      return null;
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    
    if (value instanceof Date) {
      return value;
    }
    
    // Convert objects to string representation
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  }
}
