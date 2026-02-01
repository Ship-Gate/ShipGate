/**
 * Natural Language to ISL Translator
 * 
 * Converts plain English descriptions into valid ISL specifications.
 */

import { ISL_TRANSLATION_PROMPT, ISL_LANGUAGE_REFERENCE } from './isl-reference.js';

export interface TranslationResult {
  success: boolean;
  isl?: string;
  domain?: string;
  entities?: string[];
  behaviors?: string[];
  usedLibraries?: string[];
  errors?: string[];
}

export interface TranslatorOptions {
  /** AI model to use */
  model?: string;
  /** API key for AI provider */
  apiKey?: string;
  /** Additional context about the project */
  context?: string;
  /** Preferred standard libraries to use */
  preferredLibraries?: string[];
}

/**
 * Standard library mappings for common requirements
 */
const LIBRARY_KEYWORDS: Record<string, string[]> = {
  'stdlib-auth': [
    'login', 'logout', 'sign in', 'sign up', 'register', 'authentication',
    'password', 'session', 'user account', 'forgot password', 'reset password'
  ],
  'stdlib-payments': [
    'payment', 'billing', 'subscription', 'stripe', 'credit card', 'invoice',
    'pricing', 'plan', 'checkout', 'refund', 'charge'
  ],
  'stdlib-messaging': [
    'message', 'chat', 'conversation', 'thread', 'inbox', 'send message',
    'direct message', 'dm', 'communication'
  ],
  'stdlib-notifications': [
    'notification', 'alert', 'email', 'sms', 'push notification', 'notify',
    'reminder', 'announcement'
  ],
  'stdlib-scheduling': [
    'schedule', 'appointment', 'calendar', 'booking', 'reservation',
    'availability', 'time slot', 'meeting'
  ],
  'stdlib-files': [
    'upload', 'download', 'file', 'attachment', 'document', 'image',
    'storage', 's3', 'media'
  ],
};

/**
 * Detect which standard libraries might be needed based on the description
 */
export function detectLibraries(description: string): string[] {
  const lowerDesc = description.toLowerCase();
  const detected: string[] = [];

  for (const [library, keywords] of Object.entries(LIBRARY_KEYWORDS)) {
    if (keywords.some(kw => lowerDesc.includes(kw))) {
      detected.push(library);
    }
  }

  return detected;
}

/**
 * Extract potential entity names from a description
 */
export function extractEntities(description: string): string[] {
  // Common patterns for entities
  const patterns = [
    /(?:create|manage|store|track|has|have)\s+(\w+)s?/gi,
    /(\w+)\s+(?:can|will|should|must)/gi,
    /(?:a|an|the)\s+(\w+)\s+(?:has|contains|includes)/gi,
  ];

  const entities = new Set<string>();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      const word = match[1].toLowerCase();
      // Filter out common non-entity words
      if (!['user', 'users', 'they', 'it', 'i', 'we', 'app', 'application'].includes(word)) {
        entities.add(capitalize(word));
      }
    }
  }

  return Array.from(entities);
}

/**
 * Extract potential behavior names from a description
 */
export function extractBehaviors(description: string): string[] {
  const actionWords = [
    'create', 'delete', 'update', 'get', 'list', 'search', 'find',
    'add', 'remove', 'complete', 'archive', 'publish', 'send',
    'login', 'logout', 'register', 'subscribe', 'cancel', 'approve',
    'reject', 'submit', 'review', 'assign', 'invite', 'share'
  ];

  const behaviors = new Set<string>();
  const lowerDesc = description.toLowerCase();

  for (const action of actionWords) {
    if (lowerDesc.includes(action)) {
      behaviors.add(capitalize(action));
    }
  }

  return Array.from(behaviors);
}

/**
 * Generate an ISL template based on detected patterns
 */
export function generateTemplate(
  domainName: string,
  entities: string[],
  behaviors: string[],
  libraries: string[]
): string {
  const libraryImports = libraries.map(lib => `  use ${lib}`).join('\n');
  
  const entityDefs = entities.length > 0 
    ? entities.map(entity => `
  entity ${entity} {
    id: UUID [immutable, unique]
    name: String
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }`).join('\n')
    : `
  entity Item {
    id: UUID [immutable, unique]
    name: String
    created_at: Timestamp [immutable]
  }`;

  const behaviorDefs = behaviors.length > 0
    ? behaviors.map(behavior => `
  behavior ${behavior} {
    description: "${behavior} operation"
    
    input {
      id: UUID
    }
    
    output {
      success: Boolean
      errors {
        NOT_FOUND {
          when: "Item not found"
        }
      }
    }
  }`).join('\n')
    : `
  behavior DoSomething {
    description: "Default operation"
    
    output {
      success: Boolean
    }
  }`;

  return `domain ${domainName} {
  version: "1.0.0"
${libraryImports ? `\n${libraryImports}\n` : ''}
${entityDefs}
${behaviorDefs}
}`;
}

/**
 * Translate natural language to ISL
 * 
 * This is the main entry point. It can work with or without AI:
 * - Without AI: Uses pattern matching to create a template
 * - With AI: Uses LLM to generate complete ISL
 */
export async function translate(
  description: string,
  options: TranslatorOptions = {}
): Promise<TranslationResult> {
  try {
    // Step 1: Detect what we can from the description
    const libraries = detectLibraries(description);
    const entities = extractEntities(description);
    const behaviors = extractBehaviors(description);
    
    // Extract domain name (first capitalized word or generic)
    const domainMatch = description.match(/(?:called|named|for)\s+["']?(\w+)["']?/i);
    const domain = domainMatch 
      ? capitalize(domainMatch[1]) 
      : 'MyApp';

    // Step 2: If API key provided, use AI for full translation
    if (options.apiKey) {
      const isl = await translateWithAI(description, options);
      return {
        success: true,
        isl,
        domain,
        entities,
        behaviors,
        usedLibraries: libraries,
      };
    }

    // Step 3: Without AI, generate a template
    const isl = generateTemplate(domain, entities, behaviors, libraries);
    
    return {
      success: true,
      isl,
      domain,
      entities,
      behaviors,
      usedLibraries: libraries,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Translation failed'],
    };
  }
}

/**
 * Translate using AI (Anthropic Claude)
 */
async function translateWithAI(
  description: string,
  options: TranslatorOptions
): Promise<string> {
  const { apiKey, model = 'claude-sonnet-4-20250514', context = '' } = options;

  if (!apiKey) {
    throw new Error('API key required for AI translation');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: ISL_TRANSLATION_PROMPT,
      messages: [{
        role: 'user',
        content: `${context ? `Context: ${context}\n\n` : ''}Translate this to ISL:\n\n${description}`,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI translation failed: ${response.statusText}`);
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  const text = data.content[0]?.text || '';

  // Extract ISL code block
  const islMatch = text.match(/```isl\n([\s\S]*?)```/);
  if (islMatch) {
    return islMatch[1].trim();
  }

  // If no code block, assume the whole response is ISL
  return text.trim();
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default {
  translate,
  detectLibraries,
  extractEntities,
  extractBehaviors,
  generateTemplate,
};
