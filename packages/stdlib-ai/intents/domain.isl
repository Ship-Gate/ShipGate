# AI/ML Integration Standard Library
# LLMs, Embeddings, Agents, and Model Inference

domain AI {
  version: "1.0.0"
  description: "AI-native capabilities for the intent-driven era"
  
  imports {
    core from "@intentos/stdlib-core"
  }
  
  # ============================================
  # Core Types
  # ============================================
  
  type ModelId = String
  type ConversationId = UUID
  type EmbeddingVector = List<Float>
  type TokenCount = Int [min: 0]
  
  # ============================================
  # LLM Completion
  # ============================================
  
  entity Model {
    id: ModelId [unique]
    provider: ModelProvider
    name: String
    
    # Capabilities
    capabilities: List<ModelCapability>
    
    # Limits
    context_window: TokenCount
    max_output_tokens: TokenCount?
    
    # Pricing (per 1M tokens)
    input_price: Float?
    output_price: Float?
    
    # Status
    available: Boolean
    deprecated: Boolean = false
  }
  
  enum ModelProvider {
    ANTHROPIC
    OPENAI
    GOOGLE
    MISTRAL
    META
    COHERE
    LOCAL
    CUSTOM
  }
  
  enum ModelCapability {
    TEXT_GENERATION
    CHAT
    CODE
    VISION
    AUDIO
    FUNCTION_CALLING
    JSON_MODE
    STREAMING
    EMBEDDINGS
  }
  
  behavior Complete {
    description: "Generate a completion from a prompt"
    
    input {
      model: ModelId
      prompt: String | List<Message>
      
      # Generation parameters
      max_tokens: TokenCount?
      temperature: Float? [min: 0, max: 2]
      top_p: Float? [min: 0, max: 1]
      top_k: Int?
      
      # Stop sequences
      stop: List<String>?
      
      # Output format
      response_format: ResponseFormat?
      
      # Tools/Functions
      tools: List<ToolDefinition>?
      tool_choice: ToolChoice?
      
      # Streaming
      stream: Boolean = false
      
      # Caching
      cache_prompt: Boolean = false
    }
    
    output {
      success: {
        content: String | ToolCall | List<ContentBlock>
        finish_reason: FinishReason
        usage: {
          input_tokens: TokenCount
          output_tokens: TokenCount
          cache_read_tokens: TokenCount?
          cache_write_tokens: TokenCount?
        }
        model: ModelId
      }
      errors {
        MODEL_NOT_FOUND { }
        RATE_LIMITED {
          fields { retry_after: Duration }
        }
        CONTEXT_LENGTH_EXCEEDED {
          fields { max: TokenCount, requested: TokenCount }
        }
        CONTENT_FILTERED {
          when: "Content violated safety policy"
        }
        INVALID_REQUEST { }
      }
    }
    
    temporal {
      within 30.seconds: first token (for streaming)
      within 120.seconds: complete response
    }
    
    invariants {
      # Token limits respected
      output.usage.output_tokens <= input.max_tokens ?? model.max_output_tokens
    }
  }
  
  type Message = {
    role: MessageRole
    content: String | List<ContentBlock>
    name: String?
    tool_calls: List<ToolCall>?
    tool_call_id: String?
  }
  
  enum MessageRole {
    SYSTEM
    USER
    ASSISTANT
    TOOL
  }
  
  type ContentBlock = {
    type: ContentType
    text: String?
    image: ImageContent?
    tool_use: ToolCall?
    tool_result: ToolResult?
  }
  
  enum ContentType {
    TEXT
    IMAGE
    TOOL_USE
    TOOL_RESULT
  }
  
  type ImageContent = {
    source: ImageSource
    url: URL?
    base64: String?
    media_type: String?
  }
  
  enum ImageSource {
    URL
    BASE64
  }
  
  enum FinishReason {
    STOP
    LENGTH
    TOOL_CALLS
    CONTENT_FILTER
    ERROR
  }
  
  type ResponseFormat = {
    type: FormatType
    schema: JsonSchema?
  }
  
  enum FormatType {
    TEXT
    JSON
    JSON_SCHEMA
  }
  
  # ============================================
  # Tool/Function Calling
  # ============================================
  
  type ToolDefinition = {
    name: String
    description: String
    parameters: JsonSchema
  }
  
  type ToolCall = {
    id: String
    name: String
    arguments: Map<String, Any>
  }
  
  type ToolResult = {
    tool_call_id: String
    content: String | Any
    is_error: Boolean = false
  }
  
  enum ToolChoice {
    AUTO
    NONE
    REQUIRED
    SPECIFIC { tool_name: String }
  }
  
  # ============================================
  # Conversation/Chat
  # ============================================
  
  entity Conversation {
    id: ConversationId [unique]
    
    # Model
    model: ModelId
    system_prompt: String?
    
    # Messages
    messages: List<Message>
    
    # State
    created_at: Timestamp
    updated_at: Timestamp
    
    # Usage tracking
    total_tokens: TokenCount
    
    # Metadata
    metadata: Map<String, String>?
    
    derived {
      message_count: Int = messages.length
      last_message: Message? = messages.last
    }
  }
  
  behavior Chat {
    description: "Send a message in a conversation"
    
    input {
      conversation_id: ConversationId?
      model: ModelId
      messages: List<Message>
      system: String?
      tools: List<ToolDefinition>?
      stream: Boolean = false
    }
    
    output {
      success: {
        message: Message
        conversation_id: ConversationId
        usage: TokenUsage
      }
      errors {
        CONVERSATION_NOT_FOUND { }
        CONTEXT_LENGTH_EXCEEDED { }
      }
    }
    
    effects {
      creates Conversation if new
      appends to Conversation.messages
    }
  }
  
  type TokenUsage = {
    input_tokens: TokenCount
    output_tokens: TokenCount
    total_tokens: TokenCount
  }
  
  # ============================================
  # Embeddings
  # ============================================
  
  entity EmbeddingModel {
    id: ModelId [unique]
    provider: ModelProvider
    dimensions: Int
    max_input_tokens: TokenCount
  }
  
  behavior Embed {
    description: "Generate embeddings for text"
    
    input {
      model: ModelId
      input: String | List<String>
      dimensions: Int?
      encoding_format: EncodingFormat = FLOAT
    }
    
    output {
      success: {
        embeddings: List<{
          index: Int
          embedding: EmbeddingVector
        }>
        usage: {
          total_tokens: TokenCount
        }
      }
      errors {
        MODEL_NOT_FOUND { }
        INPUT_TOO_LONG { }
      }
    }
    
    postconditions {
      result.embeddings.all(e => e.embedding.length == model.dimensions)
    }
  }
  
  enum EncodingFormat {
    FLOAT
    BASE64
  }
  
  behavior SemanticSearch {
    description: "Search by semantic similarity"
    
    input {
      query: String
      collection: String
      top_k: Int = 10
      threshold: Float?  # Minimum similarity
      filter: Map<String, Any>?
    }
    
    output {
      success: {
        results: List<{
          id: String
          score: Float
          content: String
          metadata: Map<String, Any>?
        }>
      }
    }
  }
  
  # ============================================
  # Agents
  # ============================================
  
  entity Agent {
    id: UUID [unique]
    name: String
    description: String?
    
    # Model
    model: ModelId
    system_prompt: String
    
    # Tools
    tools: List<ToolDefinition>
    
    # Behavior
    max_iterations: Int = 10
    timeout: Duration = 5.minutes
    
    # Memory
    memory_type: MemoryType?
    memory_config: Map<String, Any>?
  }
  
  enum MemoryType {
    BUFFER      { description: "Keep last N messages" }
    SUMMARY     { description: "Summarize older context" }
    VECTOR      { description: "Retrieve relevant context" }
    ENTITY      { description: "Track entities mentioned" }
    KNOWLEDGE   { description: "Structured knowledge graph" }
  }
  
  entity AgentRun {
    id: UUID [unique]
    agent_id: UUID
    
    # Input
    input: String
    
    # Execution
    status: AgentStatus
    steps: List<AgentStep>
    
    # Output
    output: String?
    error: String?
    
    # Timing
    started_at: Timestamp
    completed_at: Timestamp?
    
    # Usage
    total_tokens: TokenCount
    total_cost: Float?
    
    lifecycle {
      RUNNING -> COMPLETED [on: success]
      RUNNING -> FAILED [on: error]
      RUNNING -> CANCELLED [on: cancel]
      RUNNING -> MAX_ITERATIONS [on: limit_reached]
    }
  }
  
  enum AgentStatus {
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
    MAX_ITERATIONS
  }
  
  type AgentStep = {
    index: Int
    type: StepType
    timestamp: Timestamp
    
    # For THINK
    thought: String?
    
    # For ACT
    tool_call: ToolCall?
    tool_result: ToolResult?
    
    # For RESPOND
    response: String?
    
    tokens_used: TokenCount
  }
  
  enum StepType {
    THINK
    ACT
    OBSERVE
    RESPOND
  }
  
  behavior RunAgent {
    description: "Execute an agent task"
    
    input {
      agent_id: UUID
      input: String
      context: Map<String, Any>?
      stream: Boolean = false
    }
    
    output {
      success: {
        run_id: UUID
        output: String
        steps: List<AgentStep>
        usage: TokenUsage
      }
      errors {
        AGENT_NOT_FOUND { }
        MAX_ITERATIONS_REACHED { }
        TOOL_EXECUTION_FAILED {
          fields { tool: String, error: String }
        }
      }
    }
    
    temporal {
      within agent.timeout: completion
    }
  }
  
  # ============================================
  # RAG (Retrieval Augmented Generation)
  # ============================================
  
  entity VectorStore {
    id: UUID [unique]
    name: String
    
    embedding_model: ModelId
    dimensions: Int
    
    # Index
    index_type: VectorIndexType
    similarity_metric: SimilarityMetric
    
    # Stats
    document_count: Int
    chunk_count: Int
  }
  
  enum VectorIndexType {
    FLAT
    IVF
    HNSW
    PQ
  }
  
  enum SimilarityMetric {
    COSINE
    EUCLIDEAN
    DOT_PRODUCT
  }
  
  behavior Ingest {
    description: "Ingest documents into vector store"
    
    input {
      store_id: UUID
      documents: List<{
        id: String?
        content: String
        metadata: Map<String, Any>?
      }>
      chunk_config: {
        size: Int = 500
        overlap: Int = 50
        separator: String?
      }?
    }
    
    output {
      success: {
        ingested: Int
        chunks_created: Int
        document_ids: List<String>
      }
      errors {
        STORE_NOT_FOUND { }
        EMBEDDING_FAILED { }
      }
    }
  }
  
  behavior RAGQuery {
    description: "Query with retrieval-augmented generation"
    
    input {
      model: ModelId
      store_id: UUID
      query: String
      
      # Retrieval
      top_k: Int = 5
      threshold: Float?
      rerank: Boolean = false
      
      # Generation
      system_prompt: String?
      temperature: Float?
    }
    
    output {
      success: {
        answer: String
        sources: List<{
          chunk_id: String
          content: String
          score: Float
          metadata: Map<String, Any>?
        }>
        usage: TokenUsage
      }
    }
  }
  
  # ============================================
  # Structured Extraction
  # ============================================
  
  behavior Extract<T> {
    description: "Extract structured data from text"
    
    input {
      model: ModelId
      text: String
      schema: TypeRef<T>
      examples: List<{
        input: String
        output: T
      }>?
    }
    
    output {
      success: {
        data: T
        confidence: Float?
      }
      errors {
        EXTRACTION_FAILED { }
        SCHEMA_MISMATCH { }
      }
    }
    
    postconditions {
      result.data conforms_to input.schema
    }
  }
  
  behavior Classify {
    description: "Classify text into categories"
    
    input {
      model: ModelId
      text: String
      categories: List<{
        name: String
        description: String?
        examples: List<String>?
      }>
      multi_label: Boolean = false
    }
    
    output {
      success: {
        classifications: List<{
          category: String
          confidence: Float
        }>
      }
    }
  }
  
  behavior Summarize {
    description: "Summarize text"
    
    input {
      model: ModelId
      text: String
      max_length: Int?
      style: SummaryStyle = CONCISE
    }
    
    output {
      success: {
        summary: String
        compression_ratio: Float
      }
    }
  }
  
  enum SummaryStyle {
    CONCISE
    DETAILED
    BULLET_POINTS
    EXECUTIVE
    TECHNICAL
  }
  
  # ============================================
  # Evaluation & Safety
  # ============================================
  
  behavior EvaluateOutput {
    description: "Evaluate LLM output quality"
    
    input {
      model: ModelId
      prompt: String
      output: String
      criteria: List<EvaluationCriterion>
      reference: String?
    }
    
    output {
      success: {
        scores: Map<String, Float>
        overall_score: Float
        feedback: String?
      }
    }
  }
  
  enum EvaluationCriterion {
    RELEVANCE
    COHERENCE
    FLUENCY
    FACTUALITY
    HELPFULNESS
    HARMLESSNESS
    HONESTY
  }
  
  behavior ModerateContent {
    description: "Check content for safety"
    
    input {
      text: String
      categories: List<ModerationCategory>?
    }
    
    output {
      success: {
        flagged: Boolean
        categories: Map<ModerationCategory, {
          flagged: Boolean
          score: Float
        }>
      }
    }
  }
  
  enum ModerationCategory {
    HATE
    HARASSMENT
    SELF_HARM
    SEXUAL
    VIOLENCE
    ILLEGAL
    DECEPTION
    PII
  }
}
