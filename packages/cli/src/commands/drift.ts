/**
 * Drift Detection Command
 * 
 * Detects drift between code implementation and ISL specifications.
 * 
 * Usage:
 *   isl drift                    # Check drift for all specs in current directory
 *   isl drift <spec-file>       # Check drift for specific spec
 *   isl drift --code <path>     # Specify code path to scan
 *   isl drift --output <format> # Output format (text, json, diff)
 */

import { readFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, relative, dirname, basename, extname, join } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { parse as parseISL, type Domain } from '@isl-lang/parser';
import { ExitCode } from '../exit-codes.js';

// Import route detector - use dynamic import to handle optional dependency
let detectRoutesFn: ((content: string, filePath: string, options: { minConfidence?: number; includeSnippets?: boolean }) => {
  candidates: Array<{ category: string; httpMethod?: string; routePath?: string; line: number; name: string }>;
}) | null = null;

async function getRouteDetector() {
  if (!detectRoutesFn) {
    try {
      // Try to import from @isl-lang/core
      const coreModule = await import('@isl-lang/core');
      if (coreModule && typeof (coreModule as any).detectRoutes === 'function') {
        detectRoutesFn = (coreModule as any).detectRoutes;
      } else {
        // Try direct import
        const detectorModule = await import('@isl-lang/core/src/audit-v2/detectors/routeDetector.js');
        detectRoutesFn = detectorModule.detectRoutes;
      }
    } catch {
      // Fallback: use simple regex-based detection
      detectRoutesFn = detectRoutesSimple;
    }
  }
  return detectRoutesFn;
}

// Simple fallback route detector
function detectRoutesSimple(
  content: string,
  filePath: string,
  options: { minConfidence?: number; includeSnippets?: boolean } = {}
): { candidates: Array<{ category: string; httpMethod?: string; routePath?: string; line: number; name: string }> } {
  const candidates: Array<{ category: string; httpMethod?: string; routePath?: string; line: number; name: string }> = [];
  
  // Simple regex patterns
  const patterns = [
    { regex: /(?:app|router|server)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi },
    { regex: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/gi },
    { regex: /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/gi },
  ];
  
  for (const { regex } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      const httpMethod = match[1]?.toUpperCase() || 'GET';
      const routePath = match[2] || extractRouteFromFilePath(filePath);
      
      candidates.push({
        category: 'route',
        httpMethod,
        routePath,
        line,
        name: `${httpMethod} ${routePath}`,
      });
    }
  }
  
  return { candidates };
}

function extractRouteFromFilePath(filePath: string): string {
  // Next.js App Router
  const appRouterMatch = filePath.match(/\/app(.*)\/route\.(ts|js)x?$/);
  if (appRouterMatch) {
    return appRouterMatch[1]?.replace(/\/\[([^\]]+)\]/g, '/:$1') || '/';
  }
  
  // Next.js Pages API
  const pagesApiMatch = filePath.match(/\/pages\/api(.*)$/);
  if (pagesApiMatch) {
    const route = pagesApiMatch[1]
      ?.replace(/\.(ts|js)x?$/, '')
      .replace(/\/\[([^\]]+)\]/g, '/:$1')
      .replace(/\/index$/, '');
    return `/api${route || ''}` || '/api';
  }
  
  return '/unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DriftOptions {
  /** Path to code directory to scan */
  codePath?: string;
  /** Path to ISL spec file or directory */
  specPath?: string;
  /** Output format */
  format?: 'text' | 'json' | 'diff';
  /** Verbose output */
  verbose?: boolean;
  /** Fail on drift detected */
  failOnDrift?: boolean;
  /** Include unchanged items in output */
  includeUnchanged?: boolean;
}

export interface DetectedRoute {
  method: string;
  path: string;
  file: string;
  line: number;
  handler?: string;
}

export interface DetectedType {
  name: string;
  file: string;
  line: number;
  kind: 'interface' | 'type' | 'class' | 'enum';
  fields?: Array<{ name: string; type: string; optional?: boolean }>;
}

export interface SpecBehavior {
  name: string;
  inputs: Array<{ name: string; type: string }>;
  outputs?: { type: string };
  errors?: Array<{ name: string }>;
}

export interface SpecEntity {
  name: string;
  fields: Array<{ name: string; type: string; optional?: boolean }>;
}

export interface DriftChange {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  category: 'route' | 'behavior' | 'entity' | 'type';
  name: string;
  description: string;
  location?: {
    file: string;
    line?: number;
  };
  details?: Record<string, unknown>;
}

export interface DriftResult {
  success: boolean;
  specFile?: string;
  codePath: string;
  changes: DriftChange[];
  summary: {
    total: number;
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Scanning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan codebase for routes
 */
async function scanRoutes(codePath: string): Promise<DetectedRoute[]> {
  const routes: DetectedRoute[] = [];
  const files = await glob('**/*.{ts,tsx,js,jsx}', {
    cwd: codePath,
    ignore: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      'coverage/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.d.ts',
    ],
    absolute: true,
  });

  const detectRoutes = await getRouteDetector();

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const result = detectRoutes(content, relative(codePath, file), {
        minConfidence: 0.4,
        includeSnippets: false,
      });
      
      for (const candidate of result.candidates) {
        if (candidate.category === 'route' && candidate.httpMethod && candidate.routePath) {
          routes.push({
            method: candidate.httpMethod,
            path: candidate.routePath,
            file: relative(codePath, file),
            line: candidate.line,
            handler: candidate.name,
          });
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return routes;
}

/**
 * Scan codebase for TypeScript types
 */
async function scanTypes(codePath: string): Promise<DetectedType[]> {
  const types: DetectedType[] = [];
  const files = await glob('**/*.{ts,tsx}', {
    cwd: codePath,
    ignore: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      'coverage/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.d.ts',
    ],
    absolute: true,
  });

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8');
      const fileTypes = extractTypesFromContent(content, relative(codePath, file));
      types.push(...fileTypes);
    } catch {
      // Skip files that can't be read
    }
  }

  return types;
}

/**
 * Extract types from TypeScript content using regex
 */
function extractTypesFromContent(content: string, file: string): DetectedType[] {
  const types: DetectedType[] = [];
  const lines = content.split('\n');

  // Extract interfaces
  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    types.push({
      name: match[1],
      file,
      line,
      kind: 'interface',
      fields: extractFieldsFromInterface(content, match.index),
    });
  }

  // Extract type aliases
  const typeRegex = /(?:export\s+)?type\s+(\w+)\s*=/g;
  while ((match = typeRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    types.push({
      name: match[1],
      file,
      line,
      kind: 'type',
    });
  }

  // Extract classes
  const classRegex = /(?:export\s+)?class\s+(\w+)/g;
  while ((match = classRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    types.push({
      name: match[1],
      file,
      line,
      kind: 'class',
      fields: extractFieldsFromClass(content, match.index),
    });
  }

  // Extract enums
  const enumRegex = /(?:export\s+)?enum\s+(\w+)/g;
  while ((match = enumRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    types.push({
      name: match[1],
      file,
      line,
      kind: 'enum',
    });
  }

  return types;
}

/**
 * Extract fields from interface (simplified)
 */
function extractFieldsFromInterface(content: string, startIndex: number): Array<{ name: string; type: string; optional?: boolean }> {
  const fields: Array<{ name: string; type: string; optional?: boolean }> = [];
  const fieldRegex = /(\w+)(\?)?\s*:\s*([^;,\n]+)/g;
  
  // Find the interface block
  let braceCount = 0;
  let foundStart = false;
  let blockStart = startIndex;
  
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
      foundStart = true;
      blockStart = i + 1;
      break;
    }
  }
  
  if (!foundStart) return fields;
  
  // Extract fields from the block
  for (let i = blockStart; i < content.length && braceCount > 0; i++) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    
    if (braceCount === 1) {
      const remaining = content.substring(i);
      let fieldMatch: RegExpExecArray | null;
      while ((fieldMatch = fieldRegex.exec(remaining)) !== null) {
        fields.push({
          name: fieldMatch[1],
          type: fieldMatch[3].trim(),
          optional: fieldMatch[2] === '?',
        });
        if (fieldMatch.index + fieldMatch[0].length > 500) break; // Limit search
      }
      break;
    }
  }
  
  return fields.slice(0, 20); // Limit to first 20 fields
}

/**
 * Extract fields from class (simplified)
 */
function extractFieldsFromClass(content: string, startIndex: number): Array<{ name: string; type: string; optional?: boolean }> {
  // Similar to interface extraction
  return extractFieldsFromInterface(content, startIndex);
}

// ─────────────────────────────────────────────────────────────────────────────
// ISL Spec Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse ISL spec and extract behaviors and entities
 */
async function parseSpec(specPath: string): Promise<{
  behaviors: SpecBehavior[];
  entities: SpecEntity[];
  domain?: Domain;
}> {
  const content = await readFile(specPath, 'utf-8');
  const parseResult = parseISL(content, specPath);
  
  if (!parseResult.success || !parseResult.domain) {
    throw new Error(`Failed to parse ISL spec: ${parseResult.errors?.map(e => e.message).join(', ') || 'Unknown error'}`);
  }
  
  const domain = parseResult.domain;
  const behaviors: SpecBehavior[] = [];
  const entities: SpecEntity[] = [];
  
  // Extract behaviors
  for (const behavior of domain.behaviors || []) {
    behaviors.push({
      name: behavior.name.name,
      inputs: behavior.input.fields.map(f => ({
        name: f.name.name,
        type: f.type.type,
      })),
      outputs: behavior.output ? { type: behavior.output.type.type } : undefined,
      errors: behavior.errors.map(e => ({ name: e.name.name })),
    });
  }
  
  // Extract entities
  for (const entity of domain.entities || []) {
    entities.push({
      name: entity.name.name,
      fields: entity.fields.map(f => ({
        name: f.name.name,
        type: f.type.type,
        optional: f.optional !== undefined,
      })),
    });
  }
  
  return { behaviors, entities, domain };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drift Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect drift between code and ISL spec
 */
export async function detectDrift(
  codePath: string,
  specPath?: string,
  options: DriftOptions = {}
): Promise<DriftResult> {
  const startTime = Date.now();
  const changes: DriftChange[] = [];
  
  // Find spec file(s)
  let specFiles: string[] = [];
  if (specPath) {
    const absSpecPath = resolve(specPath);
    const stat = await stat(absSpecPath);
    if (stat.isDirectory()) {
      const files = await readdir(absSpecPath);
      specFiles = files
        .filter(f => f.endsWith('.isl'))
        .map(f => join(absSpecPath, f));
    } else if (stat.isFile()) {
      specFiles = [absSpecPath];
    }
  } else {
    // Auto-detect specs in current directory
    const cwd = process.cwd();
    const possibleSpecDirs = ['specs', '.isl', 'isl', 'src'];
    for (const dir of possibleSpecDirs) {
      const dirPath = join(cwd, dir);
      if (existsSync(dirPath)) {
        try {
          const files = await readdir(dirPath);
          specFiles.push(...files
            .filter(f => f.endsWith('.isl'))
            .map(f => join(dirPath, f)));
        } catch {
          // Skip if can't read
        }
      }
    }
    // Also check root
    const rootFiles = await glob('*.isl', { cwd, absolute: true });
    specFiles.push(...rootFiles);
  }
  
  if (specFiles.length === 0) {
    throw new Error('No ISL spec files found. Specify --spec-path or ensure .isl files exist.');
  }
  
  // Scan code
  const routes = await scanRoutes(codePath);
  const types = await scanTypes(codePath);
  
  // Compare against each spec
  for (const specFile of specFiles) {
    try {
      const spec = await parseSpec(specFile);
      
      // Compare routes vs behaviors
      const routeMap = new Map(routes.map(r => [`${r.method}:${r.path}`, r]));
      const behaviorMap = new Map(spec.behaviors.map(b => [b.name.toLowerCase(), b]));
      
      // Check for routes without behaviors (UNBOUND)
      for (const route of routes) {
        const routeKey = `${route.method}:${route.path}`;
        const behaviorName = routeToBehaviorName(route);
        const hasBehavior = behaviorMap.has(behaviorName.toLowerCase());
        
        if (!hasBehavior) {
          changes.push({
            type: 'added',
            category: 'route',
            name: routeKey,
            description: `Route ${route.method} ${route.path} found in code but no matching behavior in spec`,
            location: { file: route.file, line: route.line },
            details: { method: route.method, path: route.path },
          });
        } else if (options.includeUnchanged) {
          changes.push({
            type: 'unchanged',
            category: 'route',
            name: routeKey,
            description: `Route ${route.method} ${route.path} matches behavior ${behaviorName}`,
            location: { file: route.file, line: route.line },
          });
        }
      }
      
      // Check for behaviors without routes (removed from code)
      for (const behavior of spec.behaviors) {
        const hasRoute = routes.some(r => {
          const behaviorName = routeToBehaviorName(r);
          return behaviorName.toLowerCase() === behavior.name.toLowerCase();
        });
        
        if (!hasRoute) {
          changes.push({
            type: 'removed',
            category: 'behavior',
            name: behavior.name,
            description: `Behavior ${behavior.name} exists in spec but no matching route found in code`,
            location: { file: specFile },
          });
        }
      }
      
      // Compare types vs entities
      const typeMap = new Map(types.map(t => [t.name.toLowerCase(), t]));
      const entityMap = new Map(spec.entities.map(e => [e.name.toLowerCase(), e]));
      
      // Check for types without entities (UNBOUND)
      for (const type of types) {
        const hasEntity = entityMap.has(type.name.toLowerCase());
        
        if (!hasEntity) {
          changes.push({
            type: 'added',
            category: 'type',
            name: type.name,
            description: `Type ${type.name} found in code but no matching entity in spec`,
            location: { file: type.file, line: type.line },
            details: { kind: type.kind },
          });
        } else if (options.includeUnchanged) {
          changes.push({
            type: 'unchanged',
            category: 'type',
            name: type.name,
            description: `Type ${type.name} matches entity in spec`,
            location: { file: type.file, line: type.line },
          });
        }
      }
      
      // Check for entities without types (removed from code)
      for (const entity of spec.entities) {
        const hasType = typeMap.has(entity.name.toLowerCase());
        
        if (!hasType) {
          changes.push({
            type: 'removed',
            category: 'entity',
            name: entity.name,
            description: `Entity ${entity.name} exists in spec but no matching type found in code`,
            location: { file: specFile },
          });
        }
      }
    } catch (error) {
      changes.push({
        type: 'modified',
        category: 'behavior',
        name: basename(specFile),
        description: `Error parsing spec ${specFile}: ${error instanceof Error ? error.message : String(error)}`,
        location: { file: specFile },
      });
    }
  }
  
  // Calculate summary
  const summary = {
    total: changes.length,
    added: changes.filter(c => c.type === 'added').length,
    removed: changes.filter(c => c.type === 'removed').length,
    modified: changes.filter(c => c.type === 'modified').length,
    unchanged: changes.filter(c => c.type === 'unchanged').length,
  };
  
  const success = !options.failOnDrift || summary.added === 0 && summary.removed === 0 && summary.modified === 0;
  
  return {
    success,
    specFile: specFiles[0],
    codePath,
    changes,
    summary,
    duration: Date.now() - startTime,
  };
}

/**
 * Convert route to behavior name
 */
function routeToBehaviorName(route: DetectedRoute): string {
  // Convert GET /api/users -> GetUsers
  // Convert POST /api/users -> CreateUser or PostUsers
  const parts = route.path.split('/').filter(p => p && p !== 'api');
  const methodPrefix = route.method.charAt(0) + route.method.slice(1).toLowerCase();
  const resourceName = parts.length > 0 
    ? parts[parts.length - 1].replace(/[^a-zA-Z0-9]/g, '')
    : 'Resource';
  
  // Capitalize first letter of each part
  const capitalized = resourceName.charAt(0).toUpperCase() + resourceName.slice(1);
  
  return `${methodPrefix}${capitalized}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print drift result
 */
export function printDriftResult(
  result: DriftResult,
  options: { format?: 'text' | 'json' | 'diff'; verbose?: boolean } = {}
): void {
  const format = options.format || 'text';
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (format === 'diff') {
    // Output in unified diff format
    for (const change of result.changes) {
      if (change.type === 'unchanged' && !options.verbose) continue;
      
      const prefix = change.type === 'added' ? '+' :
                     change.type === 'removed' ? '-' :
                     change.type === 'modified' ? '~' : ' ';
      
      console.log(`${prefix} ${change.category}: ${change.name}`);
      if (change.description) {
        console.log(`  ${change.description}`);
      }
      if (change.location) {
        console.log(`  at ${change.location.file}${change.location.line ? `:${change.location.line}` : ''}`);
      }
    }
    return;
  }
  
  // Pretty text output
  console.log('');
  console.log(chalk.bold.cyan('Drift Detection Report'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log('');
  
  console.log(chalk.bold('Summary:'));
  console.log(`  Code Path: ${result.codePath}`);
  if (result.specFile) {
    console.log(`  Spec File: ${result.specFile}`);
  }
  console.log(`  Total Changes: ${result.summary.total}`);
  console.log(`  Added: ${chalk.green(result.summary.added.toString())}`);
  console.log(`  Removed: ${chalk.red(result.summary.removed.toString())}`);
  console.log(`  Modified: ${chalk.yellow(result.summary.modified.toString())}`);
  if (result.summary.unchanged > 0) {
    console.log(`  Unchanged: ${chalk.gray(result.summary.unchanged.toString())}`);
  }
  console.log('');
  
  // Group changes by type
  const added = result.changes.filter(c => c.type === 'added');
  const removed = result.changes.filter(c => c.type === 'removed');
  const modified = result.changes.filter(c => c.type === 'modified');
  
  if (added.length > 0) {
    console.log(chalk.bold.green('Added (UNBOUND):'));
    for (const change of added) {
      console.log(`  + ${change.category}: ${change.name}`);
      console.log(`    ${chalk.gray(change.description)}`);
      if (change.location) {
        console.log(`    ${chalk.gray(`at ${change.location.file}${change.location.line ? `:${change.location.line}` : ''}`)}`);
      }
    }
    console.log('');
  }
  
  if (removed.length > 0) {
    console.log(chalk.bold.red('Removed:'));
    for (const change of removed) {
      console.log(`  - ${change.category}: ${change.name}`);
      console.log(`    ${chalk.gray(change.description)}`);
      if (change.location) {
        console.log(`    ${chalk.gray(`at ${change.location.file}${change.location.line ? `:${change.location.line}` : ''}`)}`);
      }
    }
    console.log('');
  }
  
  if (modified.length > 0) {
    console.log(chalk.bold.yellow('Modified:'));
    for (const change of modified) {
      console.log(`  ~ ${change.category}: ${change.name}`);
      console.log(`    ${chalk.gray(change.description)}`);
      if (change.location) {
        console.log(`    ${chalk.gray(`at ${change.location.file}${change.location.line ? `:${change.location.line}` : ''}`)}`);
      }
    }
    console.log('');
  }
  
  console.log(chalk.gray(`Completed in ${result.duration}ms`));
  console.log('');
}

/**
 * Get exit code for drift result
 */
export function getDriftExitCode(result: DriftResult): number {
  if (!result.success) return ExitCode.ISL_ERROR;
  if (result.summary.added > 0 || result.summary.removed > 0 || result.summary.modified > 0) {
    return ExitCode.ISL_ERROR;
  }
  return ExitCode.SUCCESS;
}

/**
 * Generate ISL spec with UNBOUND markers for routes/types not in spec
 */
export async function generateSpecWithUnbound(
  codePath: string,
  existingSpecPath?: string,
): Promise<string> {
  const routes = await scanRoutes(codePath);
  const types = await scanTypes(codePath);
  
  const lines: string[] = [];
  lines.push('domain GeneratedFromCode {');
  lines.push('  version: "1.0.0"');
  lines.push('');
  
  // Generate behaviors from routes (mark as UNBOUND if not in existing spec)
  if (routes.length > 0) {
    lines.push('  # Behaviors (from routes)');
    const existingBehaviors = new Set<string>();
    
    if (existingSpecPath) {
      try {
        const spec = await parseSpec(existingSpecPath);
        spec.behaviors.forEach(b => existingBehaviors.add(b.name.toLowerCase()));
      } catch {
        // Ignore parse errors
      }
    }
    
    for (const route of routes) {
      const behaviorName = routeToBehaviorName(route);
      const isUnbound = !existingBehaviors.has(behaviorName.toLowerCase());
      const marker = isUnbound ? ' # UNBOUND' : '';
      
      lines.push('');
      lines.push(`  behavior ${behaviorName}${marker} {`);
      lines.push('    description: "Auto-generated from route"');
      lines.push('    input {');
      lines.push('      request: String');
      lines.push('    }');
      lines.push('    output {');
      lines.push('      success: Boolean');
      lines.push('    }');
      lines.push('  }');
    }
    lines.push('');
  }
  
  // Generate entities from types (mark as UNBOUND if not in existing spec)
  if (types.length > 0) {
    lines.push('  # Entities (from types)');
    const existingEntities = new Set<string>();
    
    if (existingSpecPath) {
      try {
        const spec = await parseSpec(existingSpecPath);
        spec.entities.forEach(e => existingEntities.add(e.name.toLowerCase()));
      } catch {
        // Ignore parse errors
      }
    }
    
    for (const type of types) {
      const isUnbound = !existingEntities.has(type.name.toLowerCase());
      const marker = isUnbound ? ' # UNBOUND' : '';
      
      lines.push('');
      lines.push(`  entity ${type.name}${marker} {`);
      if (type.fields && type.fields.length > 0) {
        for (const field of type.fields.slice(0, 10)) { // Limit fields
          const optional = field.optional ? '?' : '';
          lines.push(`    ${field.name}${optional}: ${field.type}`);
        }
      } else {
        lines.push('    id: String');
      }
      lines.push('  }');
    }
  }
  
  lines.push('}');
  lines.push('');
  
  return lines.join('\n');
}
