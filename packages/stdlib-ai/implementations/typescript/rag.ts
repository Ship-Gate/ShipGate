// ============================================================================
// ISL Standard Library - AI RAG (Retrieval-Augmented Generation)
// @isl-lang/stdlib-ai
// ============================================================================

import {
  type VectorStore,
  type IngestInput,
  type IngestOutput,
  type ChunkConfig,
  type RAGQueryInput,
  type RAGQueryOutput,
  type RAGSource,
  type ProviderConfig,
  VectorIndexType,
  SimilarityMetric,
  AIError,
  AIErrorCode,
} from './types';

// ============================================================================
// Vector Store Management (In-Memory)
// ============================================================================

const vectorStores = new Map<string, VectorStore>();
const documentStore = new Map<string, Map<string, StoredDocument>>();
const chunkStore = new Map<string, Map<string, StoredChunk>>();

interface StoredDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  chunk_ids: string[];
}

interface StoredChunk {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Vector Store Functions
// ============================================================================

/**
 * Create a new vector store
 */
export function createVectorStore(config: {
  name: string;
  embedding_model: string;
  dimensions?: number;
  index_type?: VectorIndexType;
  similarity_metric?: SimilarityMetric;
}): VectorStore {
  const store: VectorStore = {
    id: generateStoreId(),
    name: config.name,
    embedding_model: config.embedding_model,
    dimensions: config.dimensions || 1536,
    index_type: config.index_type || VectorIndexType.HNSW,
    similarity_metric: config.similarity_metric || SimilarityMetric.COSINE,
    document_count: 0,
    chunk_count: 0,
  };

  vectorStores.set(store.id, store);
  documentStore.set(store.id, new Map());
  chunkStore.set(store.id, new Map());

  return store;
}

/**
 * Get a vector store by ID
 */
export function getVectorStore(storeId: string): VectorStore | undefined {
  return vectorStores.get(storeId);
}

/**
 * Delete a vector store
 */
export function deleteVectorStore(storeId: string): boolean {
  documentStore.delete(storeId);
  chunkStore.delete(storeId);
  return vectorStores.delete(storeId);
}

/**
 * List all vector stores
 */
export function listVectorStores(): VectorStore[] {
  return Array.from(vectorStores.values());
}

// ============================================================================
// Document Ingestion
// ============================================================================

/**
 * Ingest documents into a vector store
 */
export async function ingest(
  input: IngestInput,
  _config?: ProviderConfig
): Promise<IngestOutput> {
  const store = vectorStores.get(input.store_id);
  if (!store) {
    throw new AIError(AIErrorCode.STORE_NOT_FOUND, `Vector store not found: ${input.store_id}`);
  }

  const docs = documentStore.get(input.store_id)!;
  const chunks = chunkStore.get(input.store_id)!;

  const documentIds: string[] = [];
  let chunksCreated = 0;

  const chunkConfig = input.chunk_config || { size: 500, overlap: 50 };

  for (const doc of input.documents) {
    const docId = doc.id || generateDocumentId();
    const docChunks = chunkText(doc.content, chunkConfig);
    const chunkIds: string[] = [];

    for (const chunkContent of docChunks) {
      const chunkId = generateChunkId();
      
      // Generate placeholder embedding - real implementation would call embedding API
      const embedding = generatePlaceholderEmbedding(store.dimensions);

      const storedChunk: StoredChunk = {
        id: chunkId,
        document_id: docId,
        content: chunkContent,
        embedding,
        metadata: doc.metadata,
      };

      chunks.set(chunkId, storedChunk);
      chunkIds.push(chunkId);
      chunksCreated++;
    }

    const storedDoc: StoredDocument = {
      id: docId,
      content: doc.content,
      metadata: doc.metadata,
      chunk_ids: chunkIds,
    };

    docs.set(docId, storedDoc);
    documentIds.push(docId);
  }

  // Update store stats
  store.document_count = docs.size;
  store.chunk_count = chunks.size;
  vectorStores.set(store.id, store);

  return {
    ingested: documentIds.length,
    chunks_created: chunksCreated,
    document_ids: documentIds,
  };
}

/**
 * Delete a document from a vector store
 */
export function deleteDocument(storeId: string, documentId: string): boolean {
  const docs = documentStore.get(storeId);
  const chunks = chunkStore.get(storeId);
  const store = vectorStores.get(storeId);

  if (!docs || !chunks || !store) {
    return false;
  }

  const doc = docs.get(documentId);
  if (!doc) {
    return false;
  }

  // Delete all chunks
  for (const chunkId of doc.chunk_ids) {
    chunks.delete(chunkId);
  }

  // Delete document
  docs.delete(documentId);

  // Update store stats
  store.document_count = docs.size;
  store.chunk_count = chunks.size;
  vectorStores.set(store.id, store);

  return true;
}

// ============================================================================
// RAG Query
// ============================================================================

/**
 * Query with retrieval-augmented generation
 */
export async function ragQuery(
  input: RAGQueryInput,
  _config?: ProviderConfig
): Promise<RAGQueryOutput> {
  const store = vectorStores.get(input.store_id);
  if (!store) {
    throw new AIError(AIErrorCode.STORE_NOT_FOUND, `Vector store not found: ${input.store_id}`);
  }

  const chunks = chunkStore.get(input.store_id)!;
  const topK = input.top_k ?? 5;

  // Generate query embedding (placeholder)
  const queryEmbedding = generatePlaceholderEmbedding(store.dimensions);

  // Find similar chunks
  const similarities = Array.from(chunks.values()).map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by similarity and take top k
  similarities.sort((a, b) => b.score - a.score);
  const topChunks = similarities.slice(0, topK);

  // Filter by threshold if provided
  const filteredChunks = input.threshold
    ? topChunks.filter(c => c.score >= input.threshold!)
    : topChunks;

  // Build sources
  const sources: RAGSource[] = filteredChunks.map(({ chunk, score }) => ({
    chunk_id: chunk.id,
    content: chunk.content,
    score,
    metadata: chunk.metadata,
  }));

  // Build context from sources
  const context = sources.map(s => s.content).join('\n\n');

  // Generate answer (placeholder - real implementation would call LLM)
  const answer = `[RAG placeholder answer for query: "${input.query}"]\n\nBased on ${sources.length} retrieved chunks.`;

  const inputTokens = Math.ceil((input.query.length + context.length) / 4);
  const outputTokens = Math.ceil(answer.length / 4);

  return {
    answer,
    sources,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  };
}

/**
 * Retrieve relevant chunks without generation
 */
export async function retrieve(
  storeId: string,
  _query: string,
  options?: {
    top_k?: number;
    threshold?: number;
    filter?: Record<string, unknown>;
  }
): Promise<RAGSource[]> {
  const store = vectorStores.get(storeId);
  if (!store) {
    throw new AIError(AIErrorCode.STORE_NOT_FOUND, `Vector store not found: ${storeId}`);
  }

  const chunks = chunkStore.get(storeId)!;
  const topK = options?.top_k ?? 10;

  // Generate query embedding (placeholder)
  const queryEmbedding = generatePlaceholderEmbedding(store.dimensions);

  // Find similar chunks
  let chunkArray = Array.from(chunks.values());

  // Apply metadata filter if provided
  if (options?.filter) {
    chunkArray = chunkArray.filter(chunk => {
      if (!chunk.metadata) return false;
      return Object.entries(options.filter!).every(
        ([key, value]) => chunk.metadata![key] === value
      );
    });
  }

  const similarities = chunkArray.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  similarities.sort((a, b) => b.score - a.score);
  const topChunks = similarities.slice(0, topK);

  const filteredChunks = options?.threshold
    ? topChunks.filter(c => c.score >= options.threshold!)
    : topChunks;

  return filteredChunks.map(({ chunk, score }) => ({
    chunk_id: chunk.id,
    content: chunk.content,
    score,
    metadata: chunk.metadata,
  }));
}

// ============================================================================
// Chunking Functions
// ============================================================================

/**
 * Chunk text using specified configuration
 */
export function chunkText(text: string, config: ChunkConfig): string[] {
  const size = config.size ?? 500;
  const overlap = config.overlap ?? 50;
  const separator = config.separator;

  if (separator) {
    // Split by separator then recombine into chunks
    const parts = text.split(separator);
    return recombineChunks(parts, size, overlap);
  }

  // Character-based chunking with overlap
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length - overlap) break;
  }

  return chunks;
}

/**
 * Recombine parts into chunks of approximately target size
 */
function recombineChunks(parts: string[], targetSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const part of parts) {
    if (currentChunk.length + part.length > targetSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep some overlap
      const words = currentChunk.split(' ');
      const overlapWords = Math.ceil(words.length * (overlap / targetSize));
      currentChunk = words.slice(-overlapWords).join(' ') + ' ' + part;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + part;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Chunk by sentences
 */
export function chunkBySentences(text: string, sentencesPerChunk: number = 3): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];

  for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
    chunks.push(sentences.slice(i, i + sentencesPerChunk).join(' ').trim());
  }

  return chunks;
}

/**
 * Chunk by paragraphs
 */
export function chunkByParagraphs(text: string, paragraphsPerChunk: number = 1): string[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const chunks: string[] = [];

  for (let i = 0; i < paragraphs.length; i += paragraphsPerChunk) {
    chunks.push(paragraphs.slice(i, i + paragraphsPerChunk).join('\n\n').trim());
  }

  return chunks;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateStoreId(): string {
  return `store_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateChunkId(): string {
  return `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generatePlaceholderEmbedding(dimensions: number): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    embedding.push(Math.random() * 2 - 1);
  }
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProductSum = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProductSum += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProductSum / magnitude;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  createVectorStore,
  getVectorStore,
  deleteVectorStore,
  listVectorStores,
  ingest,
  deleteDocument,
  ragQuery,
  retrieve,
  chunkText,
  chunkBySentences,
  chunkByParagraphs,
};
