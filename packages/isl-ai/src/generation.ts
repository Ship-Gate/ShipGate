// ============================================================================
// ISL Specification Generation
// Generate ISL specifications from natural language
// ============================================================================

import type {
  AIProvider,
  GenerationConfig,
  GeneratedComponent,
  ISLContext,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GenerationRequest {
  type: 'domain' | 'entity' | 'behavior' | 'type' | 'policy';
  description: string;
  name?: string;
  options?: GenerationConfig;
}

export interface GeneratedSpec {
  code: string;
  components: GeneratedComponent[];
  confidence: number;
  suggestions?: string[];
  tests?: string;
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate ISL specification from natural language
 */
export async function generate(
  request: GenerationRequest,
  provider: AIProvider,
  context?: ISLContext
): Promise<GeneratedSpec> {
  switch (request.type) {
    case 'domain':
      return generateDomain(request, provider, context);
    case 'entity':
      return generateEntity(request, provider, context);
    case 'behavior':
      return generateBehavior(request, provider, context);
    case 'type':
      return generateType(request, provider, context);
    case 'policy':
      return generatePolicy(request, provider, context);
    default:
      throw new Error(`Unknown generation type: ${request.type}`);
  }
}

// ============================================================================
// DOMAIN GENERATION
// ============================================================================

async function generateDomain(
  request: GenerationRequest,
  provider: AIProvider,
  _context?: ISLContext
): Promise<GeneratedSpec> {
  const prompt = `Generate a complete ISL domain specification based on:

Requirements:
${request.description}

${request.options?.style === 'documented' ? 'Include comprehensive documentation comments.' : ''}
${request.options?.includeExamples ? 'Include example scenarios.' : ''}

Structure your response as valid ISL with:
1. Domain declaration with version
2. Required type definitions
3. Entity definitions with fields, constraints, and lifecycles
4. Behavior definitions with complete specs
5. Domain invariants
6. Access policies

Respond with only the ISL code.`;

  const code = await provider.chat([
    { role: 'system', content: getISLSystemPrompt() },
    { role: 'user', content: prompt },
  ], { temperature: 0.7, maxTokens: 4000 });

  const components = extractComponents(code);
  const tests = request.options?.includeTests 
    ? await generateTests(code, provider)
    : undefined;

  return {
    code,
    components,
    confidence: 0.75,
    tests,
    suggestions: [
      'Review generated constraints for completeness',
      'Add domain-specific validation rules',
      'Consider adding temporal specifications',
    ],
  };
}

// ============================================================================
// ENTITY GENERATION
// ============================================================================

async function generateEntity(
  request: GenerationRequest,
  provider: AIProvider,
  context?: ISLContext
): Promise<GeneratedSpec> {
  const existingTypes = context?.semanticContext?.availableTypes?.join(', ') || 'standard types';
  const existingEntities = context?.semanticContext?.availableEntities?.join(', ') || 'none';

  const prompt = `Generate an ISL entity definition:

Name: ${request.name || 'determine from description'}
Description: ${request.description}

Available types: ${existingTypes}
Existing entities: ${existingEntities}

Include:
- All relevant fields with appropriate types and constraints
- Field-level validation constraints
- Entity invariants
- Lifecycle if appropriate
- Indexes for common queries

${request.options?.style === 'documented' ? 'Add documentation comments for each field.' : ''}

Respond with only the ISL entity definition.`;

  const code = await provider.chat([
    { role: 'system', content: getISLSystemPrompt() },
    { role: 'user', content: prompt },
  ]);

  return {
    code,
    components: extractComponents(code),
    confidence: 0.85,
  };
}

// ============================================================================
// BEHAVIOR GENERATION
// ============================================================================

async function generateBehavior(
  request: GenerationRequest,
  provider: AIProvider,
  context?: ISLContext
): Promise<GeneratedSpec> {
  const entities = context?.semanticContext?.availableEntities?.join(', ') || 'none';
  
  const prompt = `Generate an ISL behavior definition:

Name: ${request.name || 'determine from description'}
Description: ${request.description}

Available entities: ${entities}

Include:
- Complete input specification with validation
- Output with success type and error cases
- Preconditions (what must be true before execution)
- Postconditions (what is guaranteed after execution)
- Actor/authorization if applicable
- Security constraints
- Temporal constraints if needed

The behavior should be complete and production-ready.

Respond with only the ISL behavior definition.`;

  const code = await provider.chat([
    { role: 'system', content: getISLSystemPrompt() },
    { role: 'user', content: prompt },
  ]);

  return {
    code,
    components: extractComponents(code),
    confidence: 0.8,
  };
}

// ============================================================================
// TYPE GENERATION
// ============================================================================

async function generateType(
  request: GenerationRequest,
  provider: AIProvider,
  _context?: ISLContext
): Promise<GeneratedSpec> {
  const prompt = `Generate an ISL type definition:

Name: ${request.name || 'determine from description'}
Description: ${request.description}

Types can be:
- Enum: enumeration of values
- Struct: composite type with fields
- Constrained primitive: String/Int/Decimal with validation
- Union: one of several types

Choose the most appropriate form and include all necessary constraints.

Respond with only the ISL type definition.`;

  const code = await provider.chat([
    { role: 'system', content: getISLSystemPrompt() },
    { role: 'user', content: prompt },
  ]);

  return {
    code,
    components: extractComponents(code),
    confidence: 0.9,
  };
}

// ============================================================================
// POLICY GENERATION
// ============================================================================

async function generatePolicy(
  request: GenerationRequest,
  provider: AIProvider,
  context?: ISLContext
): Promise<GeneratedSpec> {
  const entities = context?.semanticContext?.availableEntities?.join(', ') || 'none';
  const behaviors = context?.semanticContext?.availableBehaviors?.join(', ') || 'none';

  const prompt = `Generate an ISL access policy:

Name: ${request.name || 'determine from description'}
Requirements: ${request.description}

Available entities: ${entities}
Available behaviors: ${behaviors}

Include:
- Role definitions if needed
- Permission grants
- Conditions for access
- Resource-level constraints

Respond with only the ISL policy definition.`;

  const code = await provider.chat([
    { role: 'system', content: getISLSystemPrompt() },
    { role: 'user', content: prompt },
  ]);

  return {
    code,
    components: extractComponents(code),
    confidence: 0.85,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getISLSystemPrompt(): string {
  return `You are an expert ISL (Intent Specification Language) developer. Generate clean, idiomatic ISL code following these rules:

1. Use PascalCase for entity and type names
2. Use camelCase for fields and behaviors
3. Always include appropriate constraints
4. Write clear, meaningful preconditions and postconditions
5. Include proper error handling in behaviors
6. Use appropriate ISL primitive types (String, Int, Decimal, Boolean, UUID, Timestamp, Duration, Email, URL)
7. Define enums for finite value sets
8. Use lifecycles for stateful entities
9. Add invariants for business rules
10. Include security constraints where appropriate

Always output valid ISL syntax.`;
}

function extractComponents(code: string): GeneratedComponent[] {
  const components: GeneratedComponent[] = [];

  // Extract entities
  const entityMatches = code.matchAll(/entity\s+(\w+)\s*\{[^}]*\}/gs);
  for (const match of entityMatches) {
    components.push({
      kind: 'entity',
      name: match[1] ?? 'Unknown',
      code: match[0],
      confidence: 0.85,
    });
  }

  // Extract behaviors
  const behaviorMatches = code.matchAll(/behavior\s+(\w+)\s*\{[^}]*\}/gs);
  for (const match of behaviorMatches) {
    components.push({
      kind: 'behavior',
      name: match[1] ?? 'Unknown',
      code: match[0],
      confidence: 0.8,
    });
  }

  // Extract types
  const typeMatches = code.matchAll(/(?:type|enum)\s+(\w+)\s*[={][^}]*/gs);
  for (const match of typeMatches) {
    components.push({
      kind: 'type',
      name: match[1] ?? 'Unknown',
      code: match[0],
      confidence: 0.9,
    });
  }

  // Extract policies
  const policyMatches = code.matchAll(/policy\s+(\w+)\s*\{[^}]*\}/gs);
  for (const match of policyMatches) {
    components.push({
      kind: 'policy',
      name: match[1] ?? 'Unknown',
      code: match[0],
      confidence: 0.85,
    });
  }

  return components;
}

async function generateTests(code: string, provider: AIProvider): Promise<string> {
  const prompt = `Generate ISL test scenarios for this specification:

\`\`\`isl
${code}
\`\`\`

Include:
- Happy path scenarios
- Error cases
- Edge cases
- Security tests

Use ISL scenario syntax.`;

  return provider.chat([
    { role: 'system', content: 'You are an ISL testing expert.' },
    { role: 'user', content: prompt },
  ]);
}

// ============================================================================
// BATCH GENERATION
// ============================================================================

/**
 * Generate multiple related components
 */
export async function generateBatch(
  requests: GenerationRequest[],
  provider: AIProvider,
  context?: ISLContext
): Promise<GeneratedSpec[]> {
  const results: GeneratedSpec[] = [];

  for (const request of requests) {
    const result = await generate(request, provider, context);
    results.push(result);

    // Update context with generated types
    if (result.components.length > 0 && context?.semanticContext) {
      for (const component of result.components) {
        if (component.kind === 'entity') {
          context.semanticContext.availableEntities.push(component.name);
        } else if (component.kind === 'type') {
          context.semanticContext.availableTypes.push(component.name);
        } else if (component.kind === 'behavior') {
          context.semanticContext.availableBehaviors.push(component.name);
        }
      }
    }
  }

  return results;
}

/**
 * Generate from user story
 */
export async function generateFromUserStory(
  userStory: string,
  provider: AIProvider
): Promise<GeneratedSpec> {
  const analysisPrompt = `Analyze this user story and identify ISL components needed:

"${userStory}"

Identify:
1. Entities required (with key fields)
2. Behaviors required (with actors)
3. Types needed (enums, structs)
4. Business rules (invariants)
5. Access control requirements

Respond with a structured plan.`;

  const analysis = await provider.chat([
    { role: 'system', content: 'You are an ISL architect.' },
    { role: 'user', content: analysisPrompt },
  ]);

  // Now generate the actual spec
  return generate(
    {
      type: 'domain',
      description: `${userStory}\n\nAnalysis:\n${analysis}`,
      options: { includeExamples: true, includeTests: true },
    },
    provider
  );
}
