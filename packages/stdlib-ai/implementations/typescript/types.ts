// ============================================================================
// ISL Standard Library - AI Types
// @isl-lang/stdlib-ai
// ============================================================================

// ============================================================================
// Core Types
// ============================================================================

/** Model identifier */
export type ModelId = string;

/** Conversation identifier */
export type ConversationId = string;

/** Embedding vector - array of floats */
export type EmbeddingVector = number[];

/** Token count - non-negative integer */
export type TokenCount = number;

/** JSON Schema type */
export type JsonSchema = Record<string, unknown>;

// ============================================================================
// Model Types
// ============================================================================

/** Supported model providers */
export enum ModelProvider {
  ANTHROPIC = 'ANTHROPIC',
  OPENAI = 'OPENAI',
  GOOGLE = 'GOOGLE',
  MISTRAL = 'MISTRAL',
  META = 'META',
  COHERE = 'COHERE',
  LOCAL = 'LOCAL',
  CUSTOM = 'CUSTOM',
}

/** Model capabilities */
export enum ModelCapability {
  TEXT_GENERATION = 'TEXT_GENERATION',
  CHAT = 'CHAT',
  CODE = 'CODE',
  VISION = 'VISION',
  AUDIO = 'AUDIO',
  FUNCTION_CALLING = 'FUNCTION_CALLING',
  JSON_MODE = 'JSON_MODE',
  STREAMING = 'STREAMING',
  EMBEDDINGS = 'EMBEDDINGS',
}

/** Model definition */
export interface Model {
  id: ModelId;
  provider: ModelProvider;
  name: string;
  capabilities: ModelCapability[];
  context_window: TokenCount;
  max_output_tokens?: TokenCount;
  input_price?: number;
  output_price?: number;
  available: boolean;
  deprecated: boolean;
}

// ============================================================================
// Message Types
// ============================================================================

/** Message role in conversation */
export enum MessageRole {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  TOOL = 'TOOL',
}

/** Content block type */
export enum ContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  TOOL_USE = 'TOOL_USE',
  TOOL_RESULT = 'TOOL_RESULT',
}

/** Image source type */
export enum ImageSource {
  URL = 'URL',
  BASE64 = 'BASE64',
}

/** Image content */
export interface ImageContent {
  source: ImageSource;
  url?: string;
  base64?: string;
  media_type?: string;
}

/** Tool call definition */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Tool result */
export interface ToolResult {
  tool_call_id: string;
  content: string | unknown;
  is_error: boolean;
}

/** Content block */
export interface ContentBlock {
  type: ContentType;
  text?: string;
  image?: ImageContent;
  tool_use?: ToolCall;
  tool_result?: ToolResult;
}

/** Chat message */
export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// ============================================================================
// Completion Types
// ============================================================================

/** Reason for completion finishing */
export enum FinishReason {
  STOP = 'STOP',
  LENGTH = 'LENGTH',
  TOOL_CALLS = 'TOOL_CALLS',
  CONTENT_FILTER = 'CONTENT_FILTER',
  ERROR = 'ERROR',
}

/** Response format type */
export enum FormatType {
  TEXT = 'TEXT',
  JSON = 'JSON',
  JSON_SCHEMA = 'JSON_SCHEMA',
}

/** Response format specification */
export interface ResponseFormat {
  type: FormatType;
  schema?: JsonSchema;
}

/** Tool definition */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

/** Tool choice option */
export enum ToolChoiceType {
  AUTO = 'AUTO',
  NONE = 'NONE',
  REQUIRED = 'REQUIRED',
  SPECIFIC = 'SPECIFIC',
}

export interface ToolChoice {
  type: ToolChoiceType;
  tool_name?: string;
}

/** Token usage information */
export interface TokenUsage {
  input_tokens: TokenCount;
  output_tokens: TokenCount;
  total_tokens: TokenCount;
  cache_read_tokens?: TokenCount;
  cache_write_tokens?: TokenCount;
}

/** Completion input */
export interface CompleteInput {
  model: ModelId;
  prompt: string | Message[];
  max_tokens?: TokenCount;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop?: string[];
  response_format?: ResponseFormat;
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
  stream?: boolean;
  cache_prompt?: boolean;
}

/** Completion output */
export interface CompleteOutput {
  content: string | ToolCall | ContentBlock[];
  finish_reason: FinishReason;
  usage: TokenUsage;
  model: ModelId;
}

// ============================================================================
// Conversation Types
// ============================================================================

/** Conversation entity */
export interface Conversation {
  id: ConversationId;
  model: ModelId;
  system_prompt?: string;
  messages: Message[];
  created_at: Date;
  updated_at: Date;
  total_tokens: TokenCount;
  metadata?: Record<string, string>;
}

/** Chat input */
export interface ChatInput {
  conversation_id?: ConversationId;
  model: ModelId;
  messages: Message[];
  system?: string;
  tools?: ToolDefinition[];
  stream?: boolean;
}

/** Chat output */
export interface ChatOutput {
  message: Message;
  conversation_id: ConversationId;
  usage: TokenUsage;
}

// ============================================================================
// Embedding Types
// ============================================================================

/** Embedding model */
export interface EmbeddingModel {
  id: ModelId;
  provider: ModelProvider;
  dimensions: number;
  max_input_tokens: TokenCount;
}

/** Encoding format for embeddings */
export enum EncodingFormat {
  FLOAT = 'FLOAT',
  BASE64 = 'BASE64',
}

/** Embed input */
export interface EmbedInput {
  model: ModelId;
  input: string | string[];
  dimensions?: number;
  encoding_format?: EncodingFormat;
}

/** Single embedding result */
export interface EmbeddingResult {
  index: number;
  embedding: EmbeddingVector;
}

/** Embed output */
export interface EmbedOutput {
  embeddings: EmbeddingResult[];
  usage: {
    total_tokens: TokenCount;
  };
}

/** Semantic search input */
export interface SemanticSearchInput {
  query: string;
  collection: string;
  top_k?: number;
  threshold?: number;
  filter?: Record<string, unknown>;
}

/** Semantic search result */
export interface SemanticSearchResult {
  id: string;
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Semantic search output */
export interface SemanticSearchOutput {
  results: SemanticSearchResult[];
}

// ============================================================================
// Agent Types
// ============================================================================

/** Memory type for agents */
export enum MemoryType {
  BUFFER = 'BUFFER',
  SUMMARY = 'SUMMARY',
  VECTOR = 'VECTOR',
  ENTITY = 'ENTITY',
  KNOWLEDGE = 'KNOWLEDGE',
}

/** Agent definition */
export interface Agent {
  id: string;
  name: string;
  description?: string;
  model: ModelId;
  system_prompt: string;
  tools: ToolDefinition[];
  max_iterations: number;
  timeout_ms: number;
  memory_type?: MemoryType;
  memory_config?: Record<string, unknown>;
}

/** Agent execution status */
export enum AgentStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  MAX_ITERATIONS = 'MAX_ITERATIONS',
}

/** Agent step type */
export enum StepType {
  THINK = 'THINK',
  ACT = 'ACT',
  OBSERVE = 'OBSERVE',
  RESPOND = 'RESPOND',
}

/** Agent step */
export interface AgentStep {
  index: number;
  type: StepType;
  timestamp: Date;
  thought?: string;
  tool_call?: ToolCall;
  tool_result?: ToolResult;
  response?: string;
  tokens_used: TokenCount;
}

/** Agent run */
export interface AgentRun {
  id: string;
  agent_id: string;
  input: string;
  status: AgentStatus;
  steps: AgentStep[];
  output?: string;
  error?: string;
  started_at: Date;
  completed_at?: Date;
  total_tokens: TokenCount;
  total_cost?: number;
}

/** Run agent input */
export interface RunAgentInput {
  agent_id: string;
  input: string;
  context?: Record<string, unknown>;
  stream?: boolean;
}

/** Run agent output */
export interface RunAgentOutput {
  run_id: string;
  output: string;
  steps: AgentStep[];
  usage: TokenUsage;
}

// ============================================================================
// RAG Types
// ============================================================================

/** Vector index type */
export enum VectorIndexType {
  FLAT = 'FLAT',
  IVF = 'IVF',
  HNSW = 'HNSW',
  PQ = 'PQ',
}

/** Similarity metric */
export enum SimilarityMetric {
  COSINE = 'COSINE',
  EUCLIDEAN = 'EUCLIDEAN',
  DOT_PRODUCT = 'DOT_PRODUCT',
}

/** Vector store */
export interface VectorStore {
  id: string;
  name: string;
  embedding_model: ModelId;
  dimensions: number;
  index_type: VectorIndexType;
  similarity_metric: SimilarityMetric;
  document_count: number;
  chunk_count: number;
}

/** Document to ingest */
export interface IngestDocument {
  id?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Chunk configuration */
export interface ChunkConfig {
  size?: number;
  overlap?: number;
  separator?: string;
}

/** Ingest input */
export interface IngestInput {
  store_id: string;
  documents: IngestDocument[];
  chunk_config?: ChunkConfig;
}

/** Ingest output */
export interface IngestOutput {
  ingested: number;
  chunks_created: number;
  document_ids: string[];
}

/** RAG query input */
export interface RAGQueryInput {
  model: ModelId;
  store_id: string;
  query: string;
  top_k?: number;
  threshold?: number;
  rerank?: boolean;
  system_prompt?: string;
  temperature?: number;
}

/** RAG source */
export interface RAGSource {
  chunk_id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/** RAG query output */
export interface RAGQueryOutput {
  answer: string;
  sources: RAGSource[];
  usage: TokenUsage;
}

// ============================================================================
// Extraction Types
// ============================================================================

/** Summary style */
export enum SummaryStyle {
  CONCISE = 'CONCISE',
  DETAILED = 'DETAILED',
  BULLET_POINTS = 'BULLET_POINTS',
  EXECUTIVE = 'EXECUTIVE',
  TECHNICAL = 'TECHNICAL',
}

/** Extract input */
export interface ExtractInput<T = unknown> {
  model: ModelId;
  text: string;
  schema: JsonSchema;
  examples?: Array<{
    input: string;
    output: T;
  }>;
}

/** Extract output */
export interface ExtractOutput<T = unknown> {
  data: T;
  confidence?: number;
}

/** Classification category */
export interface ClassificationCategory {
  name: string;
  description?: string;
  examples?: string[];
}

/** Classify input */
export interface ClassifyInput {
  model: ModelId;
  text: string;
  categories: ClassificationCategory[];
  multi_label?: boolean;
}

/** Classification result */
export interface ClassificationResult {
  category: string;
  confidence: number;
}

/** Classify output */
export interface ClassifyOutput {
  classifications: ClassificationResult[];
}

/** Summarize input */
export interface SummarizeInput {
  model: ModelId;
  text: string;
  max_length?: number;
  style?: SummaryStyle;
}

/** Summarize output */
export interface SummarizeOutput {
  summary: string;
  compression_ratio: number;
}

// ============================================================================
// Evaluation Types
// ============================================================================

/** Evaluation criterion */
export enum EvaluationCriterion {
  RELEVANCE = 'RELEVANCE',
  COHERENCE = 'COHERENCE',
  FLUENCY = 'FLUENCY',
  FACTUALITY = 'FACTUALITY',
  HELPFULNESS = 'HELPFULNESS',
  HARMLESSNESS = 'HARMLESSNESS',
  HONESTY = 'HONESTY',
}

/** Evaluate output input */
export interface EvaluateOutputInput {
  model: ModelId;
  prompt: string;
  output: string;
  criteria: EvaluationCriterion[];
  reference?: string;
}

/** Evaluate output result */
export interface EvaluateOutputResult {
  scores: Record<string, number>;
  overall_score: number;
  feedback?: string;
}

// ============================================================================
// Moderation Types
// ============================================================================

/** Moderation category */
export enum ModerationCategory {
  HATE = 'HATE',
  HARASSMENT = 'HARASSMENT',
  SELF_HARM = 'SELF_HARM',
  SEXUAL = 'SEXUAL',
  VIOLENCE = 'VIOLENCE',
  ILLEGAL = 'ILLEGAL',
  DECEPTION = 'DECEPTION',
  PII = 'PII',
}

/** Moderate content input */
export interface ModerateContentInput {
  text: string;
  categories?: ModerationCategory[];
}

/** Moderation score */
export interface ModerationScore {
  flagged: boolean;
  score: number;
}

/** Moderate content output */
export interface ModerateContentOutput {
  flagged: boolean;
  categories: Record<ModerationCategory, ModerationScore>;
}

// ============================================================================
// Error Types
// ============================================================================

/** AI error codes */
export enum AIErrorCode {
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  MAX_ITERATIONS_REACHED = 'MAX_ITERATIONS_REACHED',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  STORE_NOT_FOUND = 'STORE_NOT_FOUND',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  INPUT_TOO_LONG = 'INPUT_TOO_LONG',
}

/** AI error */
export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// ============================================================================
// Provider Configuration
// ============================================================================

/** Provider configuration */
export interface ProviderConfig {
  provider: ModelProvider;
  api_key?: string;
  base_url?: string;
  timeout_ms?: number;
  max_retries?: number;
  headers?: Record<string, string>;
}

/** AI client configuration */
export interface AIClientConfig {
  providers: ProviderConfig[];
  default_model?: ModelId;
  default_timeout_ms?: number;
}
