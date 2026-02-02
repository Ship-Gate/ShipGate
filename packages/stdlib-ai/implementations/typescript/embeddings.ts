// ============================================================================
// ISL Standard Library - AI Embeddings
// @isl-lang/stdlib-ai
// ============================================================================

import {
  type EmbedInput,
  type EmbedOutput,
  type EmbeddingVector,
  type SemanticSearchInput,
  type SemanticSearchOutput,
  type ProviderConfig,
  AIError,
  AIErrorCode,
} from './types';

// ============================================================================
// Embedding Functions
// ============================================================================

/**
 * Generate embeddings for text
 */
export async function embed(
  input: EmbedInput,
  _config?: ProviderConfig
): Promise<EmbedOutput> {
  // Validate input
  if (!input.model) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Model is required');
  }

  if (!input.input) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Input text is required');
  }

  const inputs = Array.isArray(input.input) ? input.input : [input.input];
  const dimensions = input.dimensions || 1536; // Default to common embedding dimension

  // This is a stub - real implementation would call the provider
  const embeddings = inputs.map((_text, index) => ({
    index,
    embedding: generatePlaceholderEmbedding(dimensions),
  }));

  const totalTokens = inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

  return {
    embeddings,
    usage: {
      total_tokens: totalTokens,
    },
  };
}

/**
 * Generate embeddings for a single text
 */
export async function embedOne(
  model: string,
  text: string,
  config?: ProviderConfig
): Promise<EmbeddingVector> {
  const result = await embed({ model, input: text }, config);
  const first = result.embeddings[0];
  if (!first) {
    throw new AIError(AIErrorCode.EMBEDDING_FAILED, 'No embedding returned');
  }
  return first.embedding;
}

/**
 * Generate embeddings for multiple texts
 */
export async function embedMany(
  model: string,
  texts: string[],
  config?: ProviderConfig
): Promise<EmbeddingVector[]> {
  const result = await embed({ model, input: texts }, config);
  return result.embeddings.map(e => e.embedding);
}

// ============================================================================
// Semantic Search
// ============================================================================

/**
 * Search by semantic similarity
 */
export async function semanticSearch(
  input: SemanticSearchInput,
  _config?: ProviderConfig
): Promise<SemanticSearchOutput> {
  // Validate input
  if (!input.query) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Query is required');
  }

  if (!input.collection) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Collection is required');
  }

  // This is a stub - real implementation would query vector store
  // topK would be used for limiting results
  void input.top_k;
  
  return {
    results: [],
  };
}

// ============================================================================
// Similarity Functions
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

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
  if (magnitude === 0) return 0;

  return dotProductSum / magnitude;
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate dot product between two vectors
 */
export function dotProduct(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }

  return sum;
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(v: EmbeddingVector): EmbeddingVector {
  const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return v;
  return v.map(val => val / magnitude);
}

/**
 * Find the k most similar vectors
 */
export function findKNearest(
  query: EmbeddingVector,
  vectors: EmbeddingVector[],
  k: number,
  metric: 'cosine' | 'euclidean' | 'dot' = 'cosine'
): Array<{ index: number; score: number }> {
  const scoreFn = {
    cosine: cosineSimilarity,
    euclidean: (a: EmbeddingVector, b: EmbeddingVector) => -euclideanDistance(a, b), // Negate for consistency (higher is better)
    dot: dotProduct,
  }[metric];

  const scores = vectors.map((v, index) => ({
    index,
    score: scoreFn(query, v),
  }));

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, k);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a placeholder embedding (for testing)
 */
function generatePlaceholderEmbedding(dimensions: number): EmbeddingVector {
  const embedding: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    embedding.push(Math.random() * 2 - 1); // Random values between -1 and 1
  }
  return normalizeVector(embedding);
}

// Declare Buffer for Node.js environment
declare const Buffer: {
  from(data: Uint8Array | string, encoding?: string): { toString(encoding: string): string };
} | undefined;

// Declare btoa/atob for environments that may not have them
declare const btoa: ((data: string) => string) | undefined;
declare const atob: ((data: string) => string) | undefined;

/**
 * Convert embedding to base64 string
 */
export function embeddingToBase64(embedding: EmbeddingVector): string {
  const floatArray = new Float32Array(embedding);
  const bytes = new Uint8Array(floatArray.buffer);
  
  // Use Buffer in Node.js environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  
  // Fallback for browser using btoa
  if (typeof btoa !== 'undefined') {
    return btoa(String.fromCharCode(...bytes));
  }
  
  throw new Error('No base64 encoding available in this environment');
}

/**
 * Convert base64 string to embedding
 */
export function base64ToEmbedding(base64: string): EmbeddingVector {
  let bytes: Uint8Array;
  
  // Use Buffer in Node.js environment
  if (typeof Buffer !== 'undefined') {
    const bufferResult = Buffer.from(base64, 'base64');
    // Convert buffer to Uint8Array
    const str = bufferResult.toString('base64');
    bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    // Actually decode from base64 properly
    const decoded = Buffer.from(base64, 'base64').toString('binary');
    bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
  } else if (typeof atob !== 'undefined') {
    // Fallback for browser using atob
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    throw new Error('No base64 decoding available in this environment');
  }
  
  const floats = new Float32Array(bytes.buffer);
  return Array.from(floats);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  embed,
  embedOne,
  embedMany,
  semanticSearch,
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  normalizeVector,
  findKNearest,
  embeddingToBase64,
  base64ToEmbedding,
};
