// ============================================================================
// ISL Standard Library - AI Completion
// @isl-lang/stdlib-ai
// ============================================================================

import {
  type CompleteInput,
  type CompleteOutput,
  type ChatInput,
  type ChatOutput,
  type Message,
  type ToolCall,
  type ContentBlock,
  type ProviderConfig,
  MessageRole,
  FinishReason,
  ContentType,
  ImageSource,
  AIError,
  AIErrorCode,
} from './types';

// Declare setTimeout for environments that may not have it typed
declare function setTimeout(callback: () => void, ms: number): unknown;

// ============================================================================
// Completion Functions
// ============================================================================

/**
 * Generate a completion from a prompt
 * This is a placeholder implementation that should be replaced with actual provider calls
 */
export async function complete(
  input: CompleteInput,
  _config?: ProviderConfig
): Promise<CompleteOutput> {
  // Validate input
  if (!input.model) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Model is required');
  }

  if (!input.prompt) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Prompt is required');
  }

  // Validate temperature if provided
  if (input.temperature !== undefined && (input.temperature < 0 || input.temperature > 2)) {
    throw new AIError(
      AIErrorCode.INVALID_REQUEST,
      'Temperature must be between 0 and 2'
    );
  }

  // Validate top_p if provided
  if (input.top_p !== undefined && (input.top_p < 0 || input.top_p > 1)) {
    throw new AIError(
      AIErrorCode.INVALID_REQUEST,
      'top_p must be between 0 and 1'
    );
  }

  // This is a stub - real implementation would call the provider
  const response: CompleteOutput = {
    content: '[Placeholder response - configure provider to get real completions]',
    finish_reason: FinishReason.STOP,
    usage: {
      input_tokens: estimateTokens(input.prompt),
      output_tokens: 10,
      total_tokens: estimateTokens(input.prompt) + 10,
    },
    model: input.model,
  };

  return response;
}

/**
 * Send a message in a conversation (chat)
 */
export async function chat(
  input: ChatInput,
  _config?: ProviderConfig
): Promise<ChatOutput> {
  // Validate input
  if (!input.model) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Model is required');
  }

  if (!input.messages || input.messages.length === 0) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Messages are required');
  }

  // Generate conversation ID if not provided
  const conversationId = input.conversation_id || generateConversationId();

  // This is a stub - real implementation would call the provider
  const assistantMessage: Message = {
    role: MessageRole.ASSISTANT,
    content: '[Placeholder response - configure provider to get real chat responses]',
  };

  const inputTokens = input.messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );

  const response: ChatOutput = {
    message: assistantMessage,
    conversation_id: conversationId,
    usage: {
      input_tokens: inputTokens,
      output_tokens: 10,
      total_tokens: inputTokens + 10,
    },
  };

  return response;
}

/**
 * Stream a completion (returns async iterator)
 */
export async function* streamComplete(
  input: CompleteInput,
  _config?: ProviderConfig
): AsyncGenerator<string, void, unknown> {
  // Validate input
  if (!input.model) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Model is required');
  }

  // This is a stub - real implementation would stream from provider
  const placeholderResponse = '[Placeholder streaming response]';
  for (const char of placeholderResponse) {
    yield char;
    // Simulate streaming delay
    await sleep(10);
  }
}

/**
 * Stream a chat response (returns async iterator)
 */
export async function* streamChat(
  input: ChatInput,
  _config?: ProviderConfig
): AsyncGenerator<string, void, unknown> {
  // Validate input
  if (!input.model) {
    throw new AIError(AIErrorCode.INVALID_REQUEST, 'Model is required');
  }

  // This is a stub - real implementation would stream from provider
  const placeholderResponse = '[Placeholder streaming chat response]';
  for (const char of placeholderResponse) {
    yield char;
    await sleep(10);
  }
}

// ============================================================================
// Message Helpers
// ============================================================================

/**
 * Create a system message
 */
export function systemMessage(content: string): Message {
  return {
    role: MessageRole.SYSTEM,
    content,
  };
}

/**
 * Create a user message
 */
export function userMessage(content: string | ContentBlock[]): Message {
  return {
    role: MessageRole.USER,
    content,
  };
}

/**
 * Create an assistant message
 */
export function assistantMessage(
  content: string | ContentBlock[],
  toolCalls?: ToolCall[]
): Message {
  return {
    role: MessageRole.ASSISTANT,
    content,
    tool_calls: toolCalls,
  };
}

/**
 * Create a tool result message
 */
export function toolMessage(toolCallId: string, content: string, _isError = false): Message {
  return {
    role: MessageRole.TOOL,
    content,
    tool_call_id: toolCallId,
  };
}

/**
 * Create a text content block
 */
export function textBlock(text: string): ContentBlock {
  return {
    type: ContentType.TEXT,
    text,
  };
}

/**
 * Create an image content block from URL
 */
export function imageUrlBlock(url: string): ContentBlock {
  return {
    type: ContentType.IMAGE,
    image: {
      source: ImageSource.URL,
      url,
    },
  };
}

/**
 * Create an image content block from base64
 */
export function imageBase64Block(base64: string, mediaType: string): ContentBlock {
  return {
    type: ContentType.IMAGE,
    image: {
      source: ImageSource.BASE64,
      base64,
      media_type: mediaType,
    },
  };
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for text (rough approximation)
 * Real implementation should use proper tokenizer
 */
export function estimateTokens(content: string | Message[] | ContentBlock[]): number {
  if (typeof content === 'string') {
    // Rough approximation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  if (Array.isArray(content)) {
    return content.reduce((sum, item) => {
      if ('role' in item) {
        // Message
        const msg = item as Message;
        if (typeof msg.content === 'string') {
          return sum + estimateTokens(msg.content);
        }
        return sum + estimateTokens(msg.content as ContentBlock[]);
      }
      // ContentBlock
      const block = item as ContentBlock;
      if (block.text) {
        return sum + estimateTokens(block.text);
      }
      return sum;
    }, 0);
  }

  return 0;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

// ============================================================================
// Exports
// ============================================================================

export default {
  complete,
  chat,
  streamComplete,
  streamChat,
  systemMessage,
  userMessage,
  assistantMessage,
  toolMessage,
  textBlock,
  imageUrlBlock,
  imageBase64Block,
  estimateTokens,
};
