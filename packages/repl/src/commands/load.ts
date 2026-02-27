// ============================================================================
// Load Command
// Load an ISL domain file
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import type { Domain, CommandResult, ParseResult, CheckResult } from '../types.js';

/**
 * Mock parse function (would use actual parser in production)
 */
function mockParse(content: string): ParseResult {
  // Simple mock parsing - extract domain name and version
  const nameMatch = content.match(/domain\s+(\w+)/);
  const versionMatch = content.match(/version\s+"([^"]+)"/);

  if (!nameMatch) {
    return {
      success: false,
      errors: [{ message: 'Missing domain declaration', location: { file: '', line: 1, column: 1, endLine: 1, endColumn: 1 } }],
    };
  }

  // Create a basic domain structure
  const domain: Domain = {
    kind: 'Domain',
    name: { name: nameMatch[1]! },
    version: { value: versionMatch?.[1] ?? '0.0.1' },
    imports: [],
    types: [],
    entities: extractEntities(content),
    behaviors: extractBehaviors(content),
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
  };

  return {
    success: true,
    domain,
    errors: [],
  };
}

/**
 * Extract entities from ISL content (simplified)
 */
function extractEntities(content: string): Domain['entities'] {
  const entities: Domain['entities'] = [];
  const entityRegex = /entity\s+(\w+)\s*\{([^}]*)\}/g;
  
  let match;
  while ((match = entityRegex.exec(content)) !== null) {
    const name = match[1]!;
    const body = match[2]!;
    
    const fields = extractFields(body);
    
    entities.push({
      kind: 'Entity',
      name: { name },
      fields,
      computed: [],
      invariants: [],
      annotations: [],
    });
  }

  return entities;
}

/**
 * Extract behaviors from ISL content (simplified)
 */
function extractBehaviors(content: string): Domain['behaviors'] {
  const behaviors: Domain['behaviors'] = [];
  const behaviorRegex = /behavior\s+(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  
  let match;
  while ((match = behaviorRegex.exec(content)) !== null) {
    const name = match[1]!;
    
    behaviors.push({
      kind: 'Behavior',
      name: { name },
      input: { kind: 'BehaviorInput', fields: [] },
      output: { 
        kind: 'BehaviorOutput', 
        success: { kind: 'PrimitiveType', name: 'Boolean' },
        errors: [],
      },
      preconditions: [],
      postconditions: [],
      sideEffects: [],
      steps: [],
      annotations: [],
    });
  }

  return behaviors;
}

/**
 * Extract fields from entity body (simplified)
 */
function extractFields(body: string): Domain['entities'][0]['fields'] {
  const fields: Domain['entities'][0]['fields'] = [];
  const fieldRegex = /(\w+)\s*:\s*(\w+)(\?)?/g;
  
  let match;
  while ((match = fieldRegex.exec(body)) !== null) {
    const name = match[1]!;
    const typeName = match[2]!;
    const optional = Boolean(match[3]);
    
    fields.push({
      kind: 'Field',
      name: { name },
      type: { kind: 'PrimitiveType', name: typeName as 'String' },
      optional,
      annotations: [],
    });
  }

  return fields;
}

/**
 * Mock check function (would use actual typechecker in production)
 */
function mockCheck(_domain: Domain): CheckResult {
  return {
    success: true,
    errors: [],
    warnings: [],
  };
}

/**
 * Load command handler
 */
export async function loadCommand(
  filePath: string | undefined,
  options: { cwd?: string } = {}
): Promise<CommandResult & { domain?: Domain }> {
  if (!filePath) {
    return {
      success: false,
      error: 'Usage: :load <file.isl>',
    };
  }

  // Resolve file path
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(options.cwd ?? process.cwd(), filePath);

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    return {
      success: false,
      error: `File not found: ${resolvedPath}`,
    };
  }

  try {
    // Read file
    const content = fs.readFileSync(resolvedPath, 'utf-8');

    // Parse
    const parseResult = mockParse(content);
    
    if (!parseResult.success) {
      const errors = parseResult.errors.map(e => 
        `  ${e.location.line}:${e.location.column} - ${e.message}`
      ).join('\n');
      
      return {
        success: false,
        error: `Parse errors:\n${errors}`,
      };
    }

    // Type check
    const checkResult = mockCheck(parseResult.domain!);
    
    // Build summary
    const domain = parseResult.domain!;
    const summary = [
      `Loaded domain: ${domain.name.name} v${domain.version.value}`,
      `  ${domain.entities.length} entities`,
      `  ${domain.behaviors.length} behaviors`,
      `  ${domain.types.length} types`,
    ];

    if (!checkResult.success) {
      summary.push('');
      summary.push('Type warnings:');
      for (const err of checkResult.errors) {
        summary.push(`  ${err.message}`);
      }
    }

    return {
      success: true,
      message: summary.join('\n'),
      domain,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to load file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Load from string content (for testing)
 */
export function loadFromString(content: string): CommandResult & { domain?: Domain } {
  const parseResult = mockParse(content);
  
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.errors.map(e => e.message).join('\n'),
    };
  }

  return {
    success: true,
    domain: parseResult.domain,
    message: `Loaded domain: ${parseResult.domain!.name.name}`,
  };
}
