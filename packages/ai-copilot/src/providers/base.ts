/**
 * Base AI Provider Interface
 */
import type {
  CopilotConfig,
  ConversationContext,
  GenerationResult,
  CompletionResult,
  CompletionRequest,
} from '../types';

export interface AIProvider {
  name: string;
  initialize(config: CopilotConfig): Promise<void>;
  generate(prompt: string, context?: ConversationContext): Promise<GenerationResult>;
  complete(request: CompletionRequest): Promise<CompletionResult>;
  streamGenerate(
    prompt: string,
    context?: ConversationContext,
    onChunk: (chunk: string) => void
  ): Promise<GenerationResult>;
  countTokens(text: string): number;
  isAvailable(): boolean;
}

export abstract class BaseProvider implements AIProvider {
  abstract name: string;
  protected config: CopilotConfig | null = null;

  abstract initialize(config: CopilotConfig): Promise<void>;
  abstract generate(prompt: string, context?: ConversationContext): Promise<GenerationResult>;
  abstract complete(request: CompletionRequest): Promise<CompletionResult>;
  abstract streamGenerate(
    prompt: string,
    context?: ConversationContext,
    onChunk: (chunk: string) => void
  ): Promise<GenerationResult>;
  abstract countTokens(text: string): number;

  isAvailable(): boolean {
    return this.config !== null;
  }

  protected buildSystemPrompt(): string {
    return `You are an expert AI assistant specialized in ISL (Intent Specification Language), a universal language for defining software contracts, behaviors, and types.

ISL Core Concepts:
1. **Domains** - Bounded contexts that group related entities and behaviors
2. **Entities** - Data structures with fields, constraints, and lifecycle
3. **Behaviors** - Operations with preconditions, postconditions, and error handling
4. **Types** - Custom type definitions with validation rules
5. **Invariants** - Business rules that must always hold true

ISL Syntax Example:
\`\`\`isl
domain UserManagement {
  entity User {
    id: UUID @generated
    email: Email @unique
    username: String @min(3) @max(30)
    status: UserStatus = PENDING
    createdAt: Timestamp @generated
    
    invariant email_format: email.isValid()
    invariant username_chars: username.matches(/^[a-zA-Z0-9_]+$/)
  }
  
  enum UserStatus { PENDING, ACTIVE, SUSPENDED, DELETED }
  
  behavior CreateUser {
    input {
      email: Email
      username: String
      password: Password
    }
    
    output {
      user: User
    }
    
    errors {
      DUPLICATE_EMAIL: "Email already registered"
      INVALID_USERNAME: "Username contains invalid characters"
    }
    
    preconditions {
      email.isValid()
      username.length >= 3
      password.isStrong()
    }
    
    postconditions {
      user.status == PENDING
      user.email == input.email
      emailVerification.sent(user.email)
    }
  }
}
\`\`\`

Guidelines:
- Always use proper ISL syntax and conventions
- Include meaningful invariants and constraints
- Define clear preconditions and postconditions
- Use descriptive error codes and messages
- Follow domain-driven design principles
- Consider security, validation, and edge cases`;
  }

  protected formatContext(context?: ConversationContext): string {
    if (!context) return '';

    let formatted = '';

    if (context.islContext) {
      formatted += '\nCurrent ISL Context:\n';
      if (context.islContext.currentDomain) {
        formatted += `- Domain: ${context.islContext.currentDomain}\n`;
      }
      if (context.islContext.entities.length > 0) {
        formatted += `- Entities: ${context.islContext.entities.join(', ')}\n`;
      }
      if (context.islContext.behaviors.length > 0) {
        formatted += `- Behaviors: ${context.islContext.behaviors.join(', ')}\n`;
      }
    }

    if (context.codeContext) {
      formatted += '\nCode Context:\n';
      formatted += `- Language: ${context.codeContext.language}\n`;
      if (context.codeContext.selectedCode) {
        formatted += `- Selected Code:\n\`\`\`\n${context.codeContext.selectedCode}\n\`\`\`\n`;
      }
    }

    if (context.messages.length > 0) {
      formatted += '\nConversation History:\n';
      const recentMessages = context.messages.slice(-5);
      for (const msg of recentMessages) {
        formatted += `${msg.role}: ${msg.content.slice(0, 200)}...\n`;
      }
    }

    return formatted;
  }
}
