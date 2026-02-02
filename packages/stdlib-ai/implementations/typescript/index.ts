// ============================================================================
// ISL Standard Library - AI Entry Point
// @isl-lang/stdlib-ai
// ============================================================================

// Re-export all types
export * from './types';

// Re-export all modules
export * from './completion';
export * from './embeddings';
export * from './agents';
export * from './rag';
export * from './extraction';
export * from './moderation';

// Re-export default objects
export { default as Completion } from './completion';
export { default as Embeddings } from './embeddings';
export { default as Agents } from './agents';
export { default as RAG } from './rag';
export { default as Extraction } from './extraction';
export { default as Moderation } from './moderation';

// Import modules for namespace
import Completion from './completion';
import Embeddings from './embeddings';
import Agents from './agents';
import RAG from './rag';
import Extraction from './extraction';
import Moderation from './moderation';

// ============================================================================
// Convenience Namespace
// ============================================================================

/**
 * AI Standard Library namespace
 * Provides access to all AI-related functionality
 */
export const AI = {
  // Completion
  complete: Completion.complete,
  chat: Completion.chat,
  streamComplete: Completion.streamComplete,
  streamChat: Completion.streamChat,

  // Message helpers
  systemMessage: Completion.systemMessage,
  userMessage: Completion.userMessage,
  assistantMessage: Completion.assistantMessage,
  toolMessage: Completion.toolMessage,
  textBlock: Completion.textBlock,
  imageUrlBlock: Completion.imageUrlBlock,
  imageBase64Block: Completion.imageBase64Block,
  estimateTokens: Completion.estimateTokens,

  // Embeddings
  embed: Embeddings.embed,
  embedOne: Embeddings.embedOne,
  embedMany: Embeddings.embedMany,
  semanticSearch: Embeddings.semanticSearch,
  cosineSimilarity: Embeddings.cosineSimilarity,
  euclideanDistance: Embeddings.euclideanDistance,
  dotProduct: Embeddings.dotProduct,
  normalizeVector: Embeddings.normalizeVector,
  findKNearest: Embeddings.findKNearest,

  // Agents
  createAgent: Agents.createAgent,
  getAgent: Agents.getAgent,
  updateAgent: Agents.updateAgent,
  deleteAgent: Agents.deleteAgent,
  listAgents: Agents.listAgents,
  runAgent: Agents.runAgent,
  getAgentRun: Agents.getAgentRun,
  cancelAgentRun: Agents.cancelAgentRun,
  listAgentRuns: Agents.listAgentRuns,
  defineTool: Agents.defineTool,
  createToolCall: Agents.createToolCall,
  createToolResult: Agents.createToolResult,
  createBufferMemory: Agents.createBufferMemory,
  createWindowMemory: Agents.createWindowMemory,

  // RAG
  createVectorStore: RAG.createVectorStore,
  getVectorStore: RAG.getVectorStore,
  deleteVectorStore: RAG.deleteVectorStore,
  listVectorStores: RAG.listVectorStores,
  ingest: RAG.ingest,
  deleteDocument: RAG.deleteDocument,
  ragQuery: RAG.ragQuery,
  retrieve: RAG.retrieve,
  chunkText: RAG.chunkText,
  chunkBySentences: RAG.chunkBySentences,
  chunkByParagraphs: RAG.chunkByParagraphs,

  // Extraction
  extract: Extraction.extract,
  extractMany: Extraction.extractMany,
  classify: Extraction.classify,
  classifyBinary: Extraction.classifyBinary,
  analyzeSentiment: Extraction.analyzeSentiment,
  summarize: Extraction.summarize,
  evaluateOutput: Extraction.evaluateOutput,
  checkGroundedness: Extraction.checkGroundedness,
  extractEntities: Extraction.extractEntities,
  extractKeyValues: Extraction.extractKeyValues,

  // Moderation
  moderateContent: Moderation.moderateContent,
  detectPII: Moderation.detectPII,
  redactPII: Moderation.redactPII,
  detectToxicity: Moderation.detectToxicity,
  checkAudienceSafety: Moderation.checkAudienceSafety,
  filterHarmfulContent: Moderation.filterHarmfulContent,
  detectPromptInjection: Moderation.detectPromptInjection,
  sanitizeInput: Moderation.sanitizeInput,
};

export default AI;
