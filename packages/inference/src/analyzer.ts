/**
 * Main Analyzer
 *
 * Orchestrates the inference process from code to ISL specs.
 */

import { parseTypeScript, type TypeScriptParseResult } from './parsers/typescript.js';
import { parsePython, type PythonParseResult } from './parsers/python.js';
import {
  extractTypes,
  extractFunctions,
  extractValidations,
  extractFromTests,
} from './extractors/index.js';
import {
  generateEntities,
  generateBehaviors,
  inferInvariants,
} from './generators/index.js';
import { enhanceWithAI } from './ai/enhancer.js';

export interface InferOptions {
  /** Source language */
  language: 'typescript' | 'python';
  /** Main source files */
  sourceFiles: string[];
  /** Test files for additional context */
  testFiles?: string[];
  /** Domain name for the generated spec */
  domainName: string;
  /** Use AI to enhance the inferred spec */
  useAI?: boolean;
  /** AI model to use */
  aiModel?: string;
  /** Include inferred invariants */
  inferInvariants?: boolean;
  /** Include temporal constraints */
  inferTemporal?: boolean;
  /** Confidence threshold (0-1) for including items */
  confidenceThreshold?: number;
}

export interface InferResult {
  /** Generated ISL specification */
  isl: string;
  /** Parsed information */
  parsed: {
    types: ExtractedType[];
    functions: ExtractedFunction[];
    validations: ExtractedValidation[];
    testCases: ExtractedTestCase[];
  };
  /** Confidence scores */
  confidence: {
    overall: number;
    entities: Map<string, number>;
    behaviors: Map<string, number>;
  };
  /** Warnings and suggestions */
  diagnostics: InferenceDiagnostic[];
}

export interface ExtractedType {
  name: string;
  fields: ExtractedField[];
  isEnum: boolean;
  enumValues?: string[];
  sourceLocation: SourceLocation;
}

export interface ExtractedField {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
  annotations: string[];
}

export interface ExtractedFunction {
  name: string;
  async: boolean;
  parameters: ExtractedParameter[];
  returnType: string;
  throwsErrors: ExtractedError[];
  validations: ExtractedValidation[];
  sideEffects: ExtractedSideEffect[];
  sourceLocation: SourceLocation;
}

export interface ExtractedParameter {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ExtractedError {
  type: string;
  condition?: string;
  message?: string;
}

export interface ExtractedValidation {
  field?: string;
  condition: string;
  errorMessage?: string;
  type: 'precondition' | 'postcondition' | 'invariant';
}

export interface ExtractedSideEffect {
  type: 'create' | 'update' | 'delete' | 'read' | 'external';
  target: string;
  description?: string;
}

export interface ExtractedTestCase {
  name: string;
  functionName: string;
  inputs: Record<string, unknown>;
  expectedOutput?: unknown;
  expectedError?: string;
  assertions: string[];
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface InferenceDiagnostic {
  severity: 'info' | 'warning' | 'error';
  message: string;
  location?: SourceLocation;
  suggestion?: string;
}

/**
 * Infer ISL specification from existing code
 */
export async function infer(options: InferOptions): Promise<InferResult> {
  const diagnostics: InferenceDiagnostic[] = [];
  const confidenceThreshold = options.confidenceThreshold ?? 0.5;

  // Step 1: Parse source files
  let parseResult: TypeScriptParseResult | PythonParseResult;

  if (options.language === 'typescript') {
    parseResult = await parseTypeScript(options.sourceFiles);
  } else {
    parseResult = await parsePython(options.sourceFiles);
  }

  // Step 2: Extract information
  const types = extractTypes(parseResult);
  const functions = extractFunctions(parseResult);
  const validations = extractValidations(parseResult);

  // Step 3: Parse test files for additional context
  let testCases: ExtractedTestCase[] = [];
  if (options.testFiles?.length) {
    const testParseResult =
      options.language === 'typescript'
        ? await parseTypeScript(options.testFiles)
        : await parsePython(options.testFiles);
    testCases = extractFromTests(testParseResult);
  }

  // Step 4: Generate ISL components
  const entities = generateEntities(types, validations);
  const behaviors = generateBehaviors(functions, validations, testCases);
  const invariants = options.inferInvariants ? inferInvariants(types, functions) : [];

  // Step 5: Build confidence scores
  const entityConfidence = new Map<string, number>();
  const behaviorConfidence = new Map<string, number>();

  for (const entity of entities) {
    const score = calculateEntityConfidence(entity, testCases);
    entityConfidence.set(entity.name, score);
    if (score < confidenceThreshold) {
      diagnostics.push({
        severity: 'warning',
        message: `Low confidence (${(score * 100).toFixed(0)}%) for entity "${entity.name}"`,
        suggestion: 'Add more test coverage or type annotations',
      });
    }
  }

  for (const behavior of behaviors) {
    const score = calculateBehaviorConfidence(behavior, testCases);
    behaviorConfidence.set(behavior.name, score);
    if (score < confidenceThreshold) {
      diagnostics.push({
        severity: 'warning',
        message: `Low confidence (${(score * 100).toFixed(0)}%) for behavior "${behavior.name}"`,
        suggestion: 'Add tests for edge cases and error conditions',
      });
    }
  }

  // Step 6: Generate ISL text
  let isl = generateISL({
    domainName: options.domainName,
    entities: entities.filter((e) => entityConfidence.get(e.name)! >= confidenceThreshold),
    behaviors: behaviors.filter((b) => behaviorConfidence.get(b.name)! >= confidenceThreshold),
    invariants,
  });

  // Step 7: Optionally enhance with AI
  if (options.useAI) {
    const enhanced = await enhanceWithAI(isl, {
      model: options.aiModel,
      sourceCode: options.sourceFiles,
      testCases,
    });
    isl = enhanced.isl;
    diagnostics.push(...enhanced.suggestions.map((s) => ({
      severity: 'info' as const,
      message: s,
    })));
  }

  // Calculate overall confidence
  const allConfidences = [
    ...Array.from(entityConfidence.values()),
    ...Array.from(behaviorConfidence.values()),
  ];
  const overallConfidence =
    allConfidences.length > 0
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 0;

  return {
    isl,
    parsed: {
      types,
      functions,
      validations,
      testCases,
    },
    confidence: {
      overall: overallConfidence,
      entities: entityConfidence,
      behaviors: behaviorConfidence,
    },
    diagnostics,
  };
}

interface GeneratedEntity {
  name: string;
  fields: ExtractedField[];
  isEnum: boolean;
  enumValues?: string[];
  invariants: string[];
}

interface GeneratedBehavior {
  name: string;
  description?: string;
  inputs: ExtractedParameter[];
  outputs: { success: string; errors: ExtractedError[] };
  preconditions: string[];
  postconditions: string[];
}

interface GenerateISLOptions {
  domainName: string;
  entities: GeneratedEntity[];
  behaviors: GeneratedBehavior[];
  invariants: string[];
}

function generateISL(options: GenerateISLOptions): string {
  const lines: string[] = [];

  lines.push(`domain ${options.domainName} {`);
  lines.push(`  version: "1.0.0"`);
  lines.push('');

  // Generate enums first
  const enums = options.entities.filter((e) => e.isEnum);
  if (enums.length > 0) {
    lines.push('  # Enumerations');
    for (const enumType of enums) {
      lines.push('');
      lines.push(`  enum ${enumType.name} {`);
      for (const value of enumType.enumValues ?? []) {
        lines.push(`    ${value}`);
      }
      lines.push('  }');
    }
    lines.push('');
  }

  // Generate entities
  const entities = options.entities.filter((e) => !e.isEnum);
  if (entities.length > 0) {
    lines.push('  # Entities');
    for (const entity of entities) {
      lines.push('');
      lines.push(`  entity ${entity.name} {`);
      for (const field of entity.fields) {
        const annotations = field.annotations.length > 0 ? ` [${field.annotations.join(', ')}]` : '';
        const optional = field.optional ? '?' : '';
        lines.push(`    ${field.name}: ${field.type}${optional}${annotations}`);
      }
      if (entity.invariants.length > 0) {
        lines.push('');
        lines.push('    invariants {');
        for (const inv of entity.invariants) {
          lines.push(`      ${inv}`);
        }
        lines.push('    }');
      }
      lines.push('  }');
    }
    lines.push('');
  }

  // Generate behaviors
  if (options.behaviors.length > 0) {
    lines.push('  # Behaviors');
    for (const behavior of options.behaviors) {
      lines.push('');
      lines.push(`  behavior ${behavior.name} {`);
      if (behavior.description) {
        lines.push(`    description: "${behavior.description}"`);
        lines.push('');
      }
      if (behavior.inputs.length > 0) {
        lines.push('    input {');
        for (const input of behavior.inputs) {
          const optional = input.optional ? '?' : '';
          lines.push(`      ${input.name}: ${input.type}${optional}`);
        }
        lines.push('    }');
        lines.push('');
      }
      lines.push('    output {');
      lines.push(`      success: ${behavior.outputs.success}`);
      if (behavior.outputs.errors.length > 0) {
        lines.push('');
        lines.push('      errors {');
        for (const error of behavior.outputs.errors) {
          lines.push(`        ${error.type} {`);
          if (error.condition) {
            lines.push(`          when: "${error.condition}"`);
          }
          lines.push('          retriable: false');
          lines.push('        }');
        }
        lines.push('      }');
      }
      lines.push('    }');
      if (behavior.preconditions.length > 0) {
        lines.push('');
        lines.push('    preconditions {');
        for (const pre of behavior.preconditions) {
          lines.push(`      ${pre}`);
        }
        lines.push('    }');
      }
      if (behavior.postconditions.length > 0) {
        lines.push('');
        lines.push('    postconditions {');
        lines.push('      success implies {');
        for (const post of behavior.postconditions) {
          lines.push(`        - ${post}`);
        }
        lines.push('      }');
        lines.push('    }');
      }
      lines.push('  }');
    }
  }

  // Global invariants
  if (options.invariants.length > 0) {
    lines.push('');
    lines.push('  # Global Invariants');
    lines.push('');
    lines.push('  invariants GlobalRules {');
    lines.push('    always {');
    for (const inv of options.invariants) {
      lines.push(`      - ${inv}`);
    }
    lines.push('    }');
    lines.push('  }');
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function calculateEntityConfidence(
  entity: GeneratedEntity,
  testCases: ExtractedTestCase[]
): number {
  let score = 0.5; // Base score

  // More fields = more complete
  if (entity.fields.length >= 3) score += 0.1;
  if (entity.fields.length >= 5) score += 0.1;

  // Has ID field
  if (entity.fields.some((f) => f.name === 'id' || f.name.endsWith('Id'))) {
    score += 0.1;
  }

  // Has timestamp fields
  if (entity.fields.some((f) => f.name.includes('At') || f.type.includes('Date'))) {
    score += 0.05;
  }

  // Has invariants
  if (entity.invariants.length > 0) {
    score += 0.1;
  }

  // Referenced in tests
  const mentioned = testCases.some(
    (t) => t.name.includes(entity.name) || JSON.stringify(t).includes(entity.name)
  );
  if (mentioned) score += 0.1;

  return Math.min(1, score);
}

function calculateBehaviorConfidence(
  behavior: GeneratedBehavior,
  testCases: ExtractedTestCase[]
): number {
  let score = 0.4; // Base score

  // Has description
  if (behavior.description) score += 0.05;

  // Has inputs
  if (behavior.inputs.length > 0) score += 0.1;

  // Has error cases
  if (behavior.outputs.errors.length > 0) score += 0.1;

  // Has preconditions
  if (behavior.preconditions.length > 0) score += 0.1;

  // Has postconditions
  if (behavior.postconditions.length > 0) score += 0.1;

  // Has test coverage
  const testCount = testCases.filter(
    (t) => t.functionName === behavior.name || t.name.toLowerCase().includes(behavior.name.toLowerCase())
  ).length;
  if (testCount >= 1) score += 0.1;
  if (testCount >= 3) score += 0.1;
  if (testCount >= 5) score += 0.05;

  return Math.min(1, score);
}
