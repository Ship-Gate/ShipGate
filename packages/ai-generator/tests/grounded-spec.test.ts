/**
 * Tests for Grounded Spec Generation
 *
 * Tests the full pipeline: code fact extraction → prompt building →
 * AI response parsing → confidence budget → JSON→ISL conversion.
 * AI calls are mocked — these test the logic, not the LLM.
 */

import { describe, it, expect } from 'vitest';
import { extractCodeFacts } from '../src/grounded-spec/fact-extractor.js';
import { detectSchemas } from '../src/grounded-spec/schema-detector.js';
import { buildSystemPrompt, buildUserPrompt, parseAIResponse } from '../src/grounded-spec/prompt-builder.js';
import { behaviorsToISL } from '../src/grounded-spec/json-to-isl.js';
import { computeConfidenceBudget, formatBudgetReport } from '../src/grounded-spec/confidence-budget.js';
import type { GroundedBehavior, CodeFacts, GroundedSpecResponse } from '../src/grounded-spec/types.js';

// ============================================================================
// Test fixtures
// ============================================================================

const SAMPLE_SOURCE = `
import { z } from 'zod';
import { prisma } from './db';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(18).optional(),
});

type CreateUserRequest = z.infer<typeof CreateUserSchema>;

interface CreateUserResponse {
  id: string;
  email: string;
  createdAt: Date;
}

/**
 * Create a new user in the system.
 * @param req - The user creation request
 * @returns The created user
 * @throws {ValidationError} If the email is invalid
 * @throws {ConflictError} If the email already exists
 */
export async function createUser(req: CreateUserRequest): Promise<CreateUserResponse> {
  const validated = CreateUserSchema.parse(req);

  if (!validated.email) {
    throw new ValidationError('Email is required');
  }

  const existing = await prisma.user.findUnique({ where: { email: validated.email } });
  if (existing) {
    throw new ConflictError('User with this email already exists');
  }

  const user = await prisma.user.create({
    data: {
      email: validated.email,
      name: validated.name,
      age: validated.age,
    },
  });

  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export function healthCheck(): { status: string } {
  return { status: 'ok' };
}
`;

const SAMPLE_AI_RESPONSE: GroundedSpecResponse = {
  behaviors: [
    {
      name: 'CreateUser',
      description: 'Create a new user in the system',
      inputs: [{ name: 'req', type: 'CreateUserRequest' }],
      output: { type: 'CreateUserResponse' },
      preconditions: [
        { expr: "req.email != ''", confidence: 0.8, evidence: ['zod: email()', 'throw ValidationError on line 33'] },
        { expr: 'req.name.length >= 1', confidence: 0.7, evidence: ['zod: min(1)'] },
        { expr: 'req.name.length <= 100', confidence: 0.7, evidence: ['zod: max(100)'] },
      ],
      postconditions: [
        { expr: "result.id != ''", confidence: 0.6, evidence: ['return { id: user.id }'] },
        { expr: 'result.email == req.email', confidence: 0.7, evidence: ['return { email: user.email }'] },
      ],
      invariants: [
        { expr: 'email_unique(result.email)', confidence: 0.5, evidence: ['prisma.user.findUnique', 'throw ConflictError'] },
      ],
      errors: [
        { when: 'email is empty or invalid', throws: 'ValidationError', confidence: 0.9, evidence: ['throw ValidationError on line 33', 'zod: email()'] },
        { when: 'email already exists', throws: 'ConflictError', confidence: 0.85, evidence: ['throw ConflictError on line 37', 'prisma.user.findUnique'] },
      ],
      effects: [
        { type: 'db_write', target: 'users', confidence: 0.9, evidence: ['prisma.user.create'] },
        { type: 'db_read', target: 'users', confidence: 0.85, evidence: ['prisma.user.findUnique'] },
      ],
    },
    {
      name: 'HealthCheck',
      description: 'Simple health check endpoint',
      inputs: [],
      output: { type: '{ status: string }' },
      preconditions: [],
      postconditions: [
        { expr: "result.status == 'ok'", confidence: 0.9, evidence: ["return { status: 'ok' }"] },
      ],
      invariants: [],
      errors: [],
      effects: [],
    },
  ],
};

// ============================================================================
// Fact Extractor Tests
// ============================================================================

describe('Fact Extractor', () => {
  it('extracts function signatures from source', async () => {
    const facts = await extractCodeFacts({
      filePath: 'test.ts',
      sourceCode: SAMPLE_SOURCE,
    });

    expect(facts.length).toBeGreaterThanOrEqual(2);

    const createUser = facts.find((f) => f.signature.name === 'createUser');
    expect(createUser).toBeDefined();
    expect(createUser!.signature.isAsync).toBe(true);
    expect(createUser!.signature.isExported).toBe(true);
    expect(createUser!.signature.params).toHaveLength(1);
    expect(createUser!.signature.params[0]!.name).toBe('req');
    expect(createUser!.signature.params[0]!.type).toBe('CreateUserRequest');
    expect(createUser!.signature.returnType).toBe('Promise<CreateUserResponse>');

    const healthCheck = facts.find((f) => f.signature.name === 'healthCheck');
    expect(healthCheck).toBeDefined();
    expect(healthCheck!.signature.isAsync).toBe(false);
    expect(healthCheck!.signature.isExported).toBe(true);
  });

  it('extracts control flow IR', async () => {
    const facts = await extractCodeFacts({
      filePath: 'test.ts',
      sourceCode: SAMPLE_SOURCE,
    });

    const createUser = facts.find((f) => f.signature.name === 'createUser')!;
    expect(createUser.controlFlow.throwSites.length).toBeGreaterThanOrEqual(2);
    expect(createUser.controlFlow.branches).toBeGreaterThanOrEqual(2);
    expect(createUser.controlFlow.awaitPoints).toBeGreaterThanOrEqual(2);

    // Check throw sites
    const validationThrow = createUser.controlFlow.throwSites.find(
      (t) => t.errorType === 'ValidationError',
    );
    expect(validationThrow).toBeDefined();
    expect(validationThrow!.message).toBe('Email is required');

    const conflictThrow = createUser.controlFlow.throwSites.find(
      (t) => t.errorType === 'ConflictError',
    );
    expect(conflictThrow).toBeDefined();
  });

  it('extracts external calls', async () => {
    const facts = await extractCodeFacts({
      filePath: 'test.ts',
      sourceCode: SAMPLE_SOURCE,
    });

    const createUser = facts.find((f) => f.signature.name === 'createUser')!;
    const calls = createUser.controlFlow.externalCalls;

    const prismaFind = calls.find((c) => c.callee.includes('prisma') && c.method === 'findUnique');
    expect(prismaFind).toBeDefined();

    const prismaCreate = calls.find((c) => c.callee.includes('prisma') && c.method === 'create');
    expect(prismaCreate).toBeDefined();
  });

  it('extracts return shapes', async () => {
    const facts = await extractCodeFacts({
      filePath: 'test.ts',
      sourceCode: SAMPLE_SOURCE,
    });

    const createUser = facts.find((f) => f.signature.name === 'createUser')!;
    expect(createUser.controlFlow.returnShapes.length).toBeGreaterThanOrEqual(1);

    const returnShape = createUser.controlFlow.returnShapes[0]!;
    expect(returnShape.fields).toContain('id');
    expect(returnShape.fields).toContain('email');
    expect(returnShape.fields).toContain('createdAt');
  });

  it('extracts docstrings', async () => {
    const facts = await extractCodeFacts({
      filePath: 'test.ts',
      sourceCode: SAMPLE_SOURCE,
    });

    const createUser = facts.find((f) => f.signature.name === 'createUser')!;
    expect(createUser.docstring).toBeDefined();
    expect(createUser.docstring!.summary).toContain('Create a new user');
    expect(createUser.docstring!.params.length).toBeGreaterThanOrEqual(1);
    expect(createUser.docstring!.throws.length).toBeGreaterThanOrEqual(2);
  });

  it('handles source with no functions gracefully', async () => {
    const facts = await extractCodeFacts({
      filePath: 'empty.ts',
      sourceCode: 'const x = 42;\ntype Foo = { bar: string };',
    });

    expect(facts).toEqual([]);
  });
});

// ============================================================================
// Schema Detector Tests
// ============================================================================

describe('Schema Detector', () => {
  it('detects zod schemas', () => {
    const schemas = detectSchemas(SAMPLE_SOURCE, 'test.ts');
    const zodSchema = schemas.find((s) => s.kind === 'zod');
    expect(zodSchema).toBeDefined();
    expect(zodSchema!.name).toBe('CreateUserSchema');
    expect(zodSchema!.fields.length).toBeGreaterThanOrEqual(2);

    const emailField = zodSchema!.fields.find((f) => f.name === 'email');
    expect(emailField).toBeDefined();
    expect(emailField!.constraints).toContain('email()');
  });

  it('detects zod field constraints', () => {
    const schemas = detectSchemas(SAMPLE_SOURCE, 'test.ts');
    const zodSchema = schemas.find((s) => s.kind === 'zod')!;

    const nameField = zodSchema.fields.find((f) => f.name === 'name');
    expect(nameField).toBeDefined();
    expect(nameField!.constraints).toContain('min(1)');
    expect(nameField!.constraints).toContain('max(100)');
  });

  it('detects prisma client usage', () => {
    const schemas = detectSchemas(SAMPLE_SOURCE, 'test.ts');
    const prismaSchema = schemas.find((s) => s.kind === 'prisma');
    expect(prismaSchema).toBeDefined();
    expect(prismaSchema!.name).toBe('user');
  });

  it('detects yup schemas', () => {
    const yupSource = `
      const userSchema = yup.object({
        email: yup.string().email().required(),
        name: yup.string().min(1).required(),
      });
    `;
    const schemas = detectSchemas(yupSource, 'test.ts');
    const yupSchema = schemas.find((s) => s.kind === 'yup');
    expect(yupSchema).toBeDefined();
    expect(yupSchema!.fields.length).toBeGreaterThanOrEqual(1);
  });

  it('detects joi schemas', () => {
    const joiSource = `
      const userSchema = Joi.object({
        email: Joi.string().email().required(),
        age: Joi.number().integer().min(18),
      });
    `;
    const schemas = detectSchemas(joiSource, 'test.ts');
    const joiSchema = schemas.find((s) => s.kind === 'joi');
    expect(joiSchema).toBeDefined();
  });

  it('returns empty for source with no schemas', () => {
    const schemas = detectSchemas('const x = 42;', 'test.ts');
    expect(schemas).toEqual([]);
  });
});

// ============================================================================
// Prompt Builder Tests
// ============================================================================

describe('Prompt Builder', () => {
  it('builds a system prompt with JSON schema constraint', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('evidence');
    expect(prompt).toContain('confidence');
    expect(prompt).toContain('"behaviors"');
    expect(prompt).toContain('speculative');
    expect(prompt).toContain('0.8');
    expect(prompt).toContain('JSON');
  });

  it('builds a user prompt from code facts', async () => {
    const facts = await extractCodeFacts({
      filePath: 'test.ts',
      sourceCode: SAMPLE_SOURCE,
    });

    const prompt = buildUserPrompt(facts);
    expect(prompt).toContain('createUser');
    expect(prompt).toContain('Typed Signature');
    expect(prompt).toContain('Control Flow Summary');
    expect(prompt).toContain('Throw Sites');
    expect(prompt).toContain('External Calls');
    expect(prompt).toContain('Return Shape');
    expect(prompt).toContain('Docstring');
    expect(prompt).toContain('Detected Schemas');
  });

  it('parses valid AI JSON response', () => {
    const raw = JSON.stringify(SAMPLE_AI_RESPONSE);
    const parsed = parseAIResponse(raw);

    expect(parsed.behaviors).toHaveLength(2);
    expect(parsed.behaviors[0]!.name).toBe('CreateUser');
    expect(parsed.behaviors[0]!.preconditions).toHaveLength(3);
    expect(parsed.behaviors[0]!.errors).toHaveLength(2);
    expect(parsed.behaviors[0]!.effects).toHaveLength(2);
  });

  it('parses AI response wrapped in markdown fences', () => {
    const raw = '```json\n' + JSON.stringify(SAMPLE_AI_RESPONSE) + '\n```';
    const parsed = parseAIResponse(raw);
    expect(parsed.behaviors).toHaveLength(2);
  });

  it('parses AI response with leading prose', () => {
    const raw = 'Here is the analysis:\n\n' + JSON.stringify(SAMPLE_AI_RESPONSE);
    const parsed = parseAIResponse(raw);
    expect(parsed.behaviors).toHaveLength(2);
  });

  it('handles trailing commas in AI response', () => {
    const raw = `{
      "behaviors": [
        {
          "name": "Test",
          "description": "test",
          "inputs": [],
          "output": {"type": "void"},
          "preconditions": [],
          "postconditions": [],
          "invariants": [],
          "errors": [],
          "effects": [],
        },
      ]
    }`;
    const parsed = parseAIResponse(raw);
    expect(parsed.behaviors).toHaveLength(1);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseAIResponse('not json at all')).toThrow('Failed to parse');
  });

  it('throws on missing behaviors key', () => {
    expect(() => parseAIResponse('{"rules": []}')).toThrow('missing "behaviors"');
  });

  it('fills in defaults for missing optional fields', () => {
    const raw = JSON.stringify({
      behaviors: [{ name: 'Minimal' }],
    });
    const parsed = parseAIResponse(raw);
    expect(parsed.behaviors[0]!.preconditions).toEqual([]);
    expect(parsed.behaviors[0]!.errors).toEqual([]);
    expect(parsed.behaviors[0]!.effects).toEqual([]);
    expect(parsed.behaviors[0]!.description).toBe('');
  });
});

// ============================================================================
// Confidence Budget Tests
// ============================================================================

describe('Confidence Budget', () => {
  it('computes budget for well-grounded behaviors', () => {
    const budget = computeConfidenceBudget(SAMPLE_AI_RESPONSE.behaviors);

    expect(budget.overallScore).toBeGreaterThan(0.5);
    expect(budget.strongCount).toBeGreaterThanOrEqual(1);
    expect(budget.speculativeCount).toBe(0);
    expect(budget.assessments.length).toBeGreaterThan(0);
  });

  it('flags speculative rules', () => {
    const speculative: GroundedBehavior[] = [
      {
        name: 'Guess',
        description: 'AI guessed this',
        inputs: [],
        output: { type: 'void' },
        preconditions: [
          { expr: 'user.isAdmin', confidence: 0.2, evidence: ['speculative: no direct evidence'] },
        ],
        postconditions: [],
        invariants: [],
        errors: [],
        effects: [],
      },
    ];

    const budget = computeConfidenceBudget(speculative);
    expect(budget.speculativeCount).toBe(1);
    expect(budget.assessments[0]!.speculative).toBe(true);
    expect(budget.assessments[0]!.adjustedConfidence).toBeLessThanOrEqual(0.25);
  });

  it('caps confidence by evidence quality', () => {
    const behaviors: GroundedBehavior[] = [
      {
        name: 'Capped',
        description: 'test',
        inputs: [],
        output: { type: 'void' },
        preconditions: [
          { expr: 'x > 0', confidence: 0.95, evidence: ['some vague pattern'] },
        ],
        postconditions: [],
        invariants: [],
        errors: [],
        effects: [],
      },
    ];

    const budget = computeConfidenceBudget(behaviors);
    // Moderate evidence should cap confidence below 0.95
    const assessment = budget.assessments[0]!;
    expect(assessment.adjustedConfidence).toBeLessThanOrEqual(assessment.rawConfidence);
  });

  it('returns zero overall score for empty behaviors', () => {
    const budget = computeConfidenceBudget([]);
    expect(budget.overallScore).toBe(0);
    expect(budget.assessments).toEqual([]);
  });

  it('formats budget report', () => {
    const budget = computeConfidenceBudget(SAMPLE_AI_RESPONSE.behaviors);
    const report = formatBudgetReport(budget);

    expect(report).toContain('CONFIDENCE BUDGET');
    expect(report).toContain('Overall Score');
    expect(report).toContain('Strong rules');
    expect(report).toContain('Speculative');
  });
});

// ============================================================================
// JSON → ISL Converter Tests
// ============================================================================

describe('JSON → ISL Converter', () => {
  it('converts behaviors to valid ISL', () => {
    const isl = behaviorsToISL(SAMPLE_AI_RESPONSE.behaviors);

    expect(isl).toContain('domain');
    expect(isl).toContain('behavior CreateUser');
    expect(isl).toContain('behavior HealthCheck');
    expect(isl).toContain('input {');
    expect(isl).toContain('req: CreateUserRequest');
    expect(isl).toContain('output {');
    expect(isl).toContain('preconditions {');
    expect(isl).toContain('postconditions {');
    expect(isl).toContain('success implies');
    expect(isl).toContain('errors {');
    expect(isl).toContain('ValidationError');
    expect(isl).toContain('ConflictError');
  });

  it('includes confidence comments', () => {
    const isl = behaviorsToISL(SAMPLE_AI_RESPONSE.behaviors, {
      includeConfidenceComments: true,
    });

    expect(isl).toContain('// confidence:');
    expect(isl).toContain('evidence:');
  });

  it('omits confidence comments when disabled', () => {
    const isl = behaviorsToISL(SAMPLE_AI_RESPONSE.behaviors, {
      includeConfidenceComments: false,
    });

    expect(isl).not.toContain('// confidence:');
  });

  it('annotates speculative rules', () => {
    const specBehaviors: GroundedBehavior[] = [
      {
        name: 'Speculative',
        description: 'test',
        inputs: [],
        output: { type: 'void' },
        preconditions: [
          { expr: 'maybe.this', confidence: 0.2, evidence: ['speculative: no direct evidence'] },
        ],
        postconditions: [],
        invariants: [],
        errors: [],
        effects: [],
      },
    ];

    const isl = behaviorsToISL(specBehaviors, { includeSpeculative: true });
    expect(isl).toContain('[speculative]');
  });

  it('filters out low-confidence rules when includeSpeculative is false', () => {
    const behaviors: GroundedBehavior[] = [
      {
        name: 'Filtered',
        description: 'test',
        inputs: [],
        output: { type: 'void' },
        preconditions: [
          { expr: 'high.confidence', confidence: 0.8, evidence: ['throw Error'] },
          { expr: 'low.confidence', confidence: 0.1, evidence: ['speculative'] },
        ],
        postconditions: [],
        invariants: [],
        errors: [],
        effects: [],
      },
    ];

    const isl = behaviorsToISL(behaviors, {
      minConfidence: 0.4,
      includeSpeculative: false,
    });

    expect(isl).toContain('high.confidence');
    expect(isl).not.toContain('low.confidence');
  });

  it('includes budget summary header when provided', () => {
    const budget = computeConfidenceBudget(SAMPLE_AI_RESPONSE.behaviors);
    const isl = behaviorsToISL(SAMPLE_AI_RESPONSE.behaviors, { budget });

    expect(isl).toContain('Grounded Spec');
    expect(isl).toContain('Overall confidence');
    expect(isl).toContain('Strong rules');
  });

  it('uses custom domain name', () => {
    const isl = behaviorsToISL(SAMPLE_AI_RESPONSE.behaviors, {
      domainName: 'UserManagement',
    });

    expect(isl).toContain('domain UserManagement');
  });

  it('infers domain name from behavior names', () => {
    const isl = behaviorsToISL(SAMPLE_AI_RESPONSE.behaviors);
    expect(isl).toContain('domain UserService');
  });

  it('includes effects as comments', () => {
    const isl = behaviorsToISL(SAMPLE_AI_RESPONSE.behaviors);
    expect(isl).toContain('// effects:');
    expect(isl).toContain('db_write');
    expect(isl).toContain('db_read');
  });
});

// ============================================================================
// End-to-end integration test (no AI call)
// ============================================================================

describe('End-to-end (mocked AI)', () => {
  it('full pipeline: extract → prompt → parse → budget → ISL', async () => {
    // Step 1: Extract facts
    const facts = await extractCodeFacts({
      filePath: 'test.ts',
      sourceCode: SAMPLE_SOURCE,
    });
    expect(facts.length).toBeGreaterThanOrEqual(2);

    // Step 2: Build prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(facts);
    expect(systemPrompt.length).toBeGreaterThan(100);
    expect(userPrompt).toContain('createUser');

    // Step 3: Mock AI response (simulate what AI would return)
    const parsed = SAMPLE_AI_RESPONSE;

    // Step 4: Compute confidence budget
    const budget = computeConfidenceBudget(parsed.behaviors);
    expect(budget.overallScore).toBeGreaterThan(0);
    expect(budget.assessments.length).toBeGreaterThan(0);

    // Step 5: Convert to ISL
    const isl = behaviorsToISL(parsed.behaviors, {
      budget,
      minConfidence: 0.4,
      includeSpeculative: true,
      includeConfidenceComments: true,
    });

    expect(isl).toContain('domain');
    expect(isl).toContain('behavior CreateUser');
    expect(isl).toContain('preconditions');
    expect(isl).toContain('postconditions');
    expect(isl).toContain('Overall confidence');
  });
});
