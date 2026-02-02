/**
 * AI Review Prompts
 * 
 * Prompt templates for AI-powered spec analysis.
 */

export interface ReviewPrompt {
  id: string;
  category: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

export const SYSTEM_PROMPT_BASE = `You are an expert ISL (Intent Specification Language) reviewer.
Your role is to analyze ISL specifications and provide actionable feedback.

ISL is a domain-specific language for specifying system behavior with:
- Entities: Domain objects with fields, invariants, and lifecycle
- Behaviors: Operations with input, output, pre/postconditions, errors
- Types: Custom types with constraints
- Invariants: Business rules that must always hold
- Temporal: Timing requirements (response times, eventual consistency)
- Security: Authentication, authorization, rate limiting
- Compliance: Regulatory requirements (GDPR, PCI-DSS, etc.)

When reviewing, consider:
1. Completeness: Are all necessary specs defined?
2. Consistency: Do specs contradict each other?
3. Security: Are there vulnerabilities or missing controls?
4. Performance: Are there efficiency concerns?
5. Best practices: Does it follow ISL conventions?`;

// ============================================================================
// REVIEW PROMPTS
// ============================================================================

export const reviewPrompts: ReviewPrompt[] = [
  {
    id: 'comprehensive-review',
    category: 'general',
    systemPrompt: SYSTEM_PROMPT_BASE,
    userPromptTemplate: `Please review the following ISL specification and provide:
1. A brief summary of what the domain does
2. Critical issues that must be fixed
3. Warnings about potential problems
4. Suggestions for improvements
5. An overall quality score (0-100)

ISL Specification:
\`\`\`isl
{{spec}}
\`\`\`

Format your response as JSON with the following structure:
{
  "summary": "...",
  "criticalIssues": [{"title": "...", "description": "...", "location": "...", "fix": "..."}],
  "warnings": [{"title": "...", "description": "...", "location": "..."}],
  "suggestions": [{"title": "...", "description": "...", "suggestedCode": "..."}],
  "score": 0-100
}`,
  },
  {
    id: 'security-review',
    category: 'security',
    systemPrompt: `${SYSTEM_PROMPT_BASE}

Focus specifically on security concerns:
- Missing authentication/authorization
- Sensitive data without proper annotations ([secret], [pii])
- Missing rate limiting
- Injection vulnerabilities
- Insecure defaults
- Missing input validation
- OWASP Top 10 concerns`,
    userPromptTemplate: `Perform a security-focused review of this ISL specification.

ISL Specification:
\`\`\`isl
{{spec}}
\`\`\`

Identify:
1. Critical security vulnerabilities
2. Missing security controls
3. Compliance gaps (GDPR, PCI-DSS if applicable)
4. Recommended security improvements

Format as JSON:
{
  "vulnerabilities": [{"severity": "critical|high|medium|low", "title": "...", "description": "...", "cwe": "...", "fix": "..."}],
  "missingControls": [...],
  "complianceGaps": [...],
  "recommendations": [...]
}`,
  },
  {
    id: 'performance-review',
    category: 'performance',
    systemPrompt: `${SYSTEM_PROMPT_BASE}

Focus specifically on performance:
- Missing indexes on frequently queried fields
- N+1 query patterns
- Unbounded queries without pagination
- Missing caching opportunities
- Expensive computed fields
- Unrealistic temporal requirements`,
    userPromptTemplate: `Analyze this ISL specification for performance concerns.

ISL Specification:
\`\`\`isl
{{spec}}
\`\`\`

Identify:
1. Performance bottlenecks
2. Missing optimizations
3. Scalability concerns
4. Recommended improvements

Format as JSON:
{
  "bottlenecks": [{"severity": "...", "title": "...", "description": "...", "impact": "...", "fix": "..."}],
  "optimizations": [...],
  "scalabilityConcerns": [...],
  "recommendations": [...]
}`,
  },
  {
    id: 'completeness-review',
    category: 'completeness',
    systemPrompt: `${SYSTEM_PROMPT_BASE}

Focus on completeness:
- Missing entity definitions
- Incomplete behavior specs (missing input/output/errors)
- Missing pre/postconditions
- Undefined types
- Missing invariants
- Incomplete error handling`,
    userPromptTemplate: `Check this ISL specification for completeness.

ISL Specification:
\`\`\`isl
{{spec}}
\`\`\`

Identify:
1. Missing definitions
2. Incomplete specifications
3. Undefined references
4. Gaps in error handling

Format as JSON:
{
  "missingDefinitions": [{"type": "entity|behavior|type", "name": "...", "reason": "..."}],
  "incompleteSpecs": [{"name": "...", "missing": [...]}],
  "undefinedReferences": [...],
  "errorHandlingGaps": [...]
}`,
  },
  {
    id: 'suggest-improvements',
    category: 'suggestions',
    systemPrompt: `${SYSTEM_PROMPT_BASE}

Generate improvement suggestions that would make the spec:
- More robust and reliable
- Better documented
- More maintainable
- More testable
- More secure`,
    userPromptTemplate: `Suggest improvements for this ISL specification.

ISL Specification:
\`\`\`isl
{{spec}}
\`\`\`

For each suggestion, provide:
1. What to improve
2. Why it matters
3. Example code showing the improvement

Format as JSON:
{
  "suggestions": [
    {
      "title": "...",
      "description": "...",
      "rationale": "...",
      "priority": "high|medium|low",
      "suggestedCode": "..."
    }
  ]
}`,
  },
  {
    id: 'naming-review',
    category: 'naming',
    systemPrompt: `${SYSTEM_PROMPT_BASE}

Focus on naming conventions and clarity:
- Consistent naming styles (PascalCase, camelCase, snake_case)
- Descriptive names
- Avoiding abbreviations
- Following domain terminology`,
    userPromptTemplate: `Review naming conventions in this ISL specification.

ISL Specification:
\`\`\`isl
{{spec}}
\`\`\`

Check for:
1. Inconsistent naming styles
2. Unclear or confusing names
3. Names that don't match their purpose
4. Better naming alternatives

Format as JSON:
{
  "issues": [{"current": "...", "suggestion": "...", "reason": "..."}],
  "inconsistencies": [...],
  "improvements": [...]
}`,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get prompt by ID
 */
export function getPromptById(id: string): ReviewPrompt | undefined {
  return reviewPrompts.find(p => p.id === id);
}

/**
 * Get prompts by category
 */
export function getPromptsByCategory(category: string): ReviewPrompt[] {
  return reviewPrompts.filter(p => p.category === category);
}

/**
 * Fill prompt template with spec
 */
export function fillPromptTemplate(prompt: ReviewPrompt, spec: string): string {
  return prompt.userPromptTemplate.replace('{{spec}}', spec);
}

/**
 * Create custom prompt
 */
export function createCustomPrompt(
  _category: string,
  focus: string,
  spec: string
): { system: string; user: string } {
  return {
    system: `${SYSTEM_PROMPT_BASE}\n\nFocus specifically on: ${focus}`,
    user: `Review this ISL specification with focus on ${focus}:

\`\`\`isl
${spec}
\`\`\`

Provide actionable feedback in JSON format.`,
  };
}
