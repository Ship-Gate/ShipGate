// ============================================================================
// ISL Code Completion
// Intelligent code completion for ISL specifications
// ============================================================================

import type {
  AIProvider,
  CompletionItem,
  CompletionKind,
  ISLContext,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CompletionContext extends ISLContext {
  prefix: string;
  suffix: string;
  triggerCharacter?: string;
}

export interface CompletionResult {
  items: CompletionItem[];
  isIncomplete: boolean;
}

export interface CompletionOptions {
  maxItems?: number;
  includeSnippets?: boolean;
  includeKeywords?: boolean;
}

// ============================================================================
// MAIN COMPLETION FUNCTION
// ============================================================================

/**
 * Get completions for ISL code
 */
export async function complete(
  context: CompletionContext,
  provider: AIProvider,
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const maxItems = options.maxItems ?? 10;
  const items: CompletionItem[] = [];

  // Determine completion context
  const completionType = determineCompletionType(context);

  switch (completionType) {
    case 'keyword':
      items.push(...getKeywordCompletions(context));
      break;

    case 'type':
      items.push(...getTypeCompletions(context));
      break;

    case 'field':
      items.push(...await getFieldCompletions(context, provider));
      break;

    case 'constraint':
      items.push(...getConstraintCompletions(context));
      break;

    case 'entity-member':
      items.push(...getEntityMemberCompletions(context));
      break;

    case 'behavior-section':
      items.push(...getBehaviorSectionCompletions(context));
      break;

    case 'expression':
      items.push(...await getExpressionCompletions(context, provider));
      break;

    case 'annotation':
      items.push(...getAnnotationCompletions(context));
      break;

    default:
      // AI-powered general completion
      items.push(...await getAICompletions(context, provider, maxItems));
  }

  // Include snippets if requested
  if (options.includeSnippets !== false) {
    items.push(...getSnippetCompletions(context));
  }

  return {
    items: items.slice(0, maxItems),
    isIncomplete: items.length >= maxItems,
  };
}

// ============================================================================
// COMPLETION TYPE DETECTION
// ============================================================================

type CompletionType =
  | 'keyword'
  | 'type'
  | 'field'
  | 'constraint'
  | 'entity-member'
  | 'behavior-section'
  | 'expression'
  | 'annotation'
  | 'general';

function determineCompletionType(context: CompletionContext): CompletionType {
  const { prefix, triggerCharacter } = context;
  const lastLine = prefix.split('\n').pop() || '';
  const trimmedLine = lastLine.trim();

  // Annotation trigger
  if (triggerCharacter === '@' || trimmedLine.startsWith('@')) {
    return 'annotation';
  }

  // After colon = type expected
  if (trimmedLine.endsWith(':') || trimmedLine.match(/:\s*$/)) {
    return 'type';
  }

  // Inside entity definition
  if (isInsideEntity(prefix)) {
    if (trimmedLine === '' || trimmedLine.endsWith('}')) {
      return 'entity-member';
    }
    if (trimmedLine.includes('where') || trimmedLine.includes('check')) {
      return 'constraint';
    }
  }

  // Inside behavior definition
  if (isInsideBehavior(prefix)) {
    if (trimmedLine === '' || ['input', 'output', 'pre', 'post', 'security', 'temporal'].some(k => trimmedLine.endsWith(k))) {
      return 'behavior-section';
    }
    if (trimmedLine.includes('where') || trimmedLine.includes('ensure') || trimmedLine.includes('require')) {
      return 'expression';
    }
  }

  // At domain level
  if (isDomainLevel(prefix)) {
    return 'keyword';
  }

  return 'general';
}

function isInsideEntity(code: string): boolean {
  const entityMatch = code.match(/entity\s+\w+\s*\{/g);
  const closingBraces = (code.match(/\}/g) || []).length;
  return entityMatch !== null && entityMatch.length > closingBraces;
}

function isInsideBehavior(code: string): boolean {
  const behaviorMatch = code.match(/behavior\s+\w+/g);
  return behaviorMatch !== null && !code.endsWith('}');
}

function isDomainLevel(code: string): boolean {
  // Check if we're at the top level of the domain
  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  return openBraces <= closeBraces + 1;
}

// ============================================================================
// KEYWORD COMPLETIONS
// ============================================================================

function getKeywordCompletions(_context: CompletionContext): CompletionItem[] {
  const keywords = [
    { label: 'entity', detail: 'Define a domain entity', snippet: 'entity ${1:Name} {\n  $0\n}' },
    { label: 'behavior', detail: 'Define a behavior', snippet: 'behavior ${1:Name} {\n  $0\n}' },
    { label: 'type', detail: 'Define a custom type', snippet: 'type ${1:Name} = ${0}' },
    { label: 'enum', detail: 'Define an enumeration', snippet: 'enum ${1:Name} {\n  $0\n}' },
    { label: 'invariant', detail: 'Define a domain invariant', snippet: 'invariant ${1:name}: ${0}' },
    { label: 'policy', detail: 'Define an access policy', snippet: 'policy ${1:Name} {\n  $0\n}' },
    { label: 'view', detail: 'Define a view', snippet: 'view ${1:Name} {\n  $0\n}' },
    { label: 'import', detail: 'Import from another domain', snippet: 'import { ${1:items} } from "${0:module}"' },
  ];

  return keywords.map(k => ({
    label: k.label,
    kind: 'keyword' as CompletionKind,
    detail: k.detail,
    insertText: k.snippet,
    sortText: `0${k.label}`,
  }));
}

// ============================================================================
// TYPE COMPLETIONS
// ============================================================================

function getTypeCompletions(context: CompletionContext): CompletionItem[] {
  const primitiveTypes = [
    { label: 'String', detail: 'Text value' },
    { label: 'Int', detail: 'Integer number' },
    { label: 'Decimal', detail: 'Decimal number' },
    { label: 'Boolean', detail: 'True/false value' },
    { label: 'UUID', detail: 'Unique identifier' },
    { label: 'Timestamp', detail: 'Date and time' },
    { label: 'Duration', detail: 'Time duration' },
    { label: 'Date', detail: 'Calendar date' },
    { label: 'Time', detail: 'Time of day' },
    { label: 'Email', detail: 'Email address' },
    { label: 'URL', detail: 'URL/URI' },
    { label: 'JSON', detail: 'JSON data' },
    { label: 'Bytes', detail: 'Binary data' },
  ];

  const genericTypes = [
    { label: 'List', detail: 'Collection of items', snippet: 'List<${1:Type}>' },
    { label: 'Set', detail: 'Unique collection', snippet: 'Set<${1:Type}>' },
    { label: 'Map', detail: 'Key-value mapping', snippet: 'Map<${1:KeyType}, ${2:ValueType}>' },
    { label: 'Optional', detail: 'Nullable value', snippet: '${1:Type}?' },
  ];

  const items: CompletionItem[] = [];

  // Add primitive types
  for (const type of primitiveTypes) {
    items.push({
      label: type.label,
      kind: 'type',
      detail: type.detail,
      insertText: type.label,
      sortText: `1${type.label}`,
    });
  }

  // Add generic types
  for (const type of genericTypes) {
    items.push({
      label: type.label,
      kind: 'type',
      detail: type.detail,
      insertText: type.snippet || type.label,
      sortText: `2${type.label}`,
    });
  }

  // Add available custom types from context
  const customTypes = context.semanticContext?.availableTypes || [];
  for (const type of customTypes) {
    items.push({
      label: type,
      kind: 'type',
      detail: 'Custom type',
      insertText: type,
      sortText: `3${type}`,
    });
  }

  // Add available entities as reference types
  const entities = context.semanticContext?.availableEntities || [];
  for (const entity of entities) {
    items.push({
      label: entity,
      kind: 'entity',
      detail: 'Entity reference',
      insertText: entity,
      sortText: `4${entity}`,
    });
  }

  return items;
}

// ============================================================================
// FIELD COMPLETIONS
// ============================================================================

async function getFieldCompletions(
  context: CompletionContext,
  _provider: AIProvider
): Promise<CompletionItem[]> {
  const items: CompletionItem[] = [];
  const entityName = context.semanticContext?.currentEntity?.name.name;

  if (!entityName) return items;

  // Common field patterns based on entity name
  const commonFields = getCommonFieldsForEntity(entityName);
  
  for (const field of commonFields) {
    items.push({
      label: field.name,
      kind: 'field',
      detail: field.type,
      documentation: field.description,
      insertText: `${field.name}: ${field.type}`,
      sortText: `0${field.name}`,
    });
  }

  return items;
}

function getCommonFieldsForEntity(entityName: string): Array<{ name: string; type: string; description: string }> {
  const lowerName = entityName.toLowerCase();
  const fields: Array<{ name: string; type: string; description: string }> = [];

  // Always suggest id and timestamps
  fields.push({ name: 'id', type: 'UUID', description: 'Unique identifier' });
  fields.push({ name: 'createdAt', type: 'Timestamp', description: 'Creation timestamp' });
  fields.push({ name: 'updatedAt', type: 'Timestamp', description: 'Last update timestamp' });

  // Entity-specific suggestions
  if (lowerName.includes('user') || lowerName.includes('account')) {
    fields.push({ name: 'email', type: 'Email', description: 'User email address' });
    fields.push({ name: 'name', type: 'String', description: 'User name' });
    fields.push({ name: 'status', type: 'UserStatus', description: 'Account status' });
  }

  if (lowerName.includes('order') || lowerName.includes('purchase')) {
    fields.push({ name: 'total', type: 'Decimal', description: 'Order total' });
    fields.push({ name: 'status', type: 'OrderStatus', description: 'Order status' });
    fields.push({ name: 'items', type: 'List<OrderItem>', description: 'Order items' });
  }

  if (lowerName.includes('product') || lowerName.includes('item')) {
    fields.push({ name: 'name', type: 'String', description: 'Product name' });
    fields.push({ name: 'price', type: 'Decimal', description: 'Product price' });
    fields.push({ name: 'description', type: 'String?', description: 'Product description' });
  }

  return fields;
}

// ============================================================================
// CONSTRAINT COMPLETIONS
// ============================================================================

function getConstraintCompletions(_context: CompletionContext): CompletionItem[] {
  const constraints = [
    { label: 'minLength', snippet: 'minLength(${1:1})' },
    { label: 'maxLength', snippet: 'maxLength(${1:100})' },
    { label: 'pattern', snippet: 'pattern("${1:regex}")' },
    { label: 'min', snippet: 'min(${1:0})' },
    { label: 'max', snippet: 'max(${1:100})' },
    { label: 'positive', snippet: 'positive' },
    { label: 'negative', snippet: 'negative' },
    { label: 'notEmpty', snippet: 'notEmpty' },
    { label: 'unique', snippet: 'unique' },
    { label: 'email', snippet: 'email' },
    { label: 'url', snippet: 'url' },
    { label: 'future', snippet: 'future' },
    { label: 'past', snippet: 'past' },
  ];

  return constraints.map(c => ({
    label: c.label,
    kind: 'constraint' as CompletionKind,
    detail: 'Constraint',
    insertText: c.snippet,
    sortText: `0${c.label}`,
  }));
}

// ============================================================================
// ENTITY MEMBER COMPLETIONS
// ============================================================================

function getEntityMemberCompletions(_context: CompletionContext): CompletionItem[] {
  return [
    { label: 'field', kind: 'snippet', detail: 'Add a field', insertText: '${1:name}: ${2:Type}' },
    { label: 'invariant', kind: 'keyword', detail: 'Add an invariant', insertText: 'invariant ${1:name}: ${0}' },
    { label: 'lifecycle', kind: 'keyword', detail: 'Add lifecycle', insertText: 'lifecycle {\n  ${1:Initial} -> ${2:Final}\n}' },
    { label: 'index', kind: 'keyword', detail: 'Add an index', insertText: 'index on (${1:field})' },
  ];
}

// ============================================================================
// BEHAVIOR SECTION COMPLETIONS
// ============================================================================

function getBehaviorSectionCompletions(_context: CompletionContext): CompletionItem[] {
  return [
    { label: 'input', kind: 'keyword', detail: 'Define input fields', insertText: 'input {\n  ${0}\n}' },
    { label: 'output', kind: 'keyword', detail: 'Define output', insertText: 'output {\n  success: ${1:Type}\n  error: ${2:ErrorType}\n}' },
    { label: 'precondition', kind: 'keyword', detail: 'Add precondition', insertText: 'pre: ${0}' },
    { label: 'postcondition', kind: 'keyword', detail: 'Add postcondition', insertText: 'post: ${0}' },
    { label: 'actor', kind: 'keyword', detail: 'Specify actor', insertText: 'actor: ${0:User}' },
    { label: 'security', kind: 'keyword', detail: 'Add security constraint', insertText: 'security {\n  requires: ${0:permission}\n}' },
    { label: 'temporal', kind: 'keyword', detail: 'Add temporal constraint', insertText: 'temporal {\n  ${0}\n}' },
  ];
}

// ============================================================================
// EXPRESSION COMPLETIONS
// ============================================================================

async function getExpressionCompletions(
  _context: CompletionContext,
  _provider: AIProvider
): Promise<CompletionItem[]> {
  const items: CompletionItem[] = [];

  // Common expression patterns
  const patterns = [
    { label: 'input.', detail: 'Access input field' },
    { label: 'result.', detail: 'Access result field' },
    { label: 'old.', detail: 'Previous value' },
    { label: 'exists', snippet: '${1:Entity}.exists(${2:condition})' },
    { label: 'forall', snippet: 'forall ${1:x} in ${2:collection}: ${0}' },
    { label: 'exists in', snippet: 'exists ${1:x} in ${2:collection}: ${0}' },
    { label: 'count', snippet: '${1:collection}.count() ${2:> 0}' },
    { label: 'and', snippet: '${1:condition} and ${0}' },
    { label: 'or', snippet: '${1:condition} or ${0}' },
    { label: 'not', snippet: 'not ${0}' },
    { label: 'implies', snippet: '${1:condition} implies ${0}' },
  ];

  for (const p of patterns) {
    items.push({
      label: p.label,
      kind: 'snippet',
      detail: p.detail || 'Expression',
      insertText: p.snippet || p.label,
    });
  }

  return items;
}

// ============================================================================
// ANNOTATION COMPLETIONS
// ============================================================================

function getAnnotationCompletions(_context: CompletionContext): CompletionItem[] {
  const annotations = [
    { label: '@deprecated', detail: 'Mark as deprecated', snippet: '@deprecated("${1:reason}")' },
    { label: '@description', detail: 'Add description', snippet: '@description("${1:text}")' },
    { label: '@example', detail: 'Add example', snippet: '@example("${1:example}")' },
    { label: '@since', detail: 'Version introduced', snippet: '@since("${1:1.0.0}")' },
    { label: '@unique', detail: 'Unique constraint', snippet: '@unique' },
    { label: '@indexed', detail: 'Database index', snippet: '@indexed' },
    { label: '@sensitive', detail: 'Mark as sensitive data', snippet: '@sensitive' },
    { label: '@audit', detail: 'Enable audit logging', snippet: '@audit' },
    { label: '@cache', detail: 'Enable caching', snippet: '@cache(ttl: ${1:3600})' },
    { label: '@rateLimit', detail: 'Rate limiting', snippet: '@rateLimit(${1:100}/minute)' },
    { label: '@timeout', detail: 'Timeout setting', snippet: '@timeout(${1:30s})' },
    { label: '@retry', detail: 'Retry policy', snippet: '@retry(max: ${1:3}, backoff: ${2:exponential})' },
  ];

  return annotations.map(a => ({
    label: a.label,
    kind: 'annotation' as CompletionKind,
    detail: a.detail,
    insertText: a.snippet,
  }));
}

// ============================================================================
// SNIPPET COMPLETIONS
// ============================================================================

function getSnippetCompletions(_context: CompletionContext): CompletionItem[] {
  const snippets = [
    {
      label: 'entity-full',
      detail: 'Full entity template',
      insertText: `entity \${1:Name} {
  id: UUID
  \${2:field}: \${3:Type}
  createdAt: Timestamp
  updatedAt: Timestamp

  invariant positive_\${2}: \${2} >= 0

  lifecycle {
    Created -> Active -> Archived
  }
}`,
    },
    {
      label: 'behavior-crud',
      detail: 'CRUD behavior template',
      insertText: `behavior Create\${1:Entity} {
  actor: \${2:User}

  input {
    \${3:data}: \${4:CreateInput}
  }

  output {
    success: \${1:Entity}
    error: ValidationError | AuthorizationError
  }

  pre: actor.can("create", "\${1:Entity}")
  post: \${1:Entity}.exists(result.id)
}`,
    },
    {
      label: 'enum-status',
      detail: 'Status enum template',
      insertText: `enum \${1:Entity}Status {
  Pending
  Active
  Suspended
  Archived
}`,
    },
  ];

  return snippets.map(s => ({
    label: s.label,
    kind: 'snippet' as CompletionKind,
    detail: s.detail,
    insertText: s.insertText,
  }));
}

// ============================================================================
// AI COMPLETIONS
// ============================================================================

async function getAICompletions(
  context: CompletionContext,
  provider: AIProvider,
  maxItems: number
): Promise<CompletionItem[]> {
  const prompt = `Complete this ISL code. Provide ${maxItems} possible completions:

${context.prefix}[CURSOR]${context.suffix.slice(0, 100)}

Context: ${context.semanticContext ? JSON.stringify(context.semanticContext, null, 2) : 'none'}

Respond with a JSON array of completions: [{"label": "...", "insertText": "...", "detail": "..."}]`;

  try {
    const response = await provider.complete(prompt, {
      maxTokens: 500,
      temperature: 0.5,
    });

    const items = JSON.parse(response);
    return items.slice(0, maxItems).map((item: Record<string, string>) => ({
      label: item.label,
      kind: 'value' as CompletionKind,
      detail: item.detail,
      insertText: item.insertText || item.label,
    }));
  } catch {
    return [];
  }
}
