/**
 * Handler Detector for Audit
 *
 * Detects business logic handlers, services, and other implementations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DetectedImplementation, DetectedPattern, ImplementationType } from '../auditTypes.js';

/**
 * Handler patterns to detect
 */
const HANDLER_PATTERNS = {
  // Service methods
  serviceMethod: [
    /(?:class\s+\w*Service|\w+Service\s*=|@Injectable)/gi,
  ],
  // Use case / command handlers
  useCase: [
    /(?:class\s+\w*(?:UseCase|Command|Handler)|execute\s*\(|handle\s*\()/gi,
  ],
  // Repository patterns
  repository: [
    /(?:class\s+\w*Repository|\w+Repository|@Repository)/gi,
  ],
  // Controller methods (not routes)
  controller: [
    /(?:class\s+\w*Controller|@Controller)/gi,
  ],
  // Event handlers
  eventHandler: [
    /(?:@EventHandler|@Subscribe|on\w+Event|handleEvent)/gi,
  ],
  // Queue handlers
  queueHandler: [
    /(?:@Process|@Processor|handleJob|processMessage)/gi,
  ],
  // Cron/scheduled jobs
  scheduledJob: [
    /(?:@Cron|@Scheduled|schedule\s*\(|cron\s*\()/gi,
  ],
};

/**
 * Detect handlers in a single file
 */
export async function detectHandlersInFile(
  workspacePath: string,
  filePath: string
): Promise<DetectedImplementation[]> {
  const implementations: DetectedImplementation[] = [];
  const fullPath = path.join(workspacePath, filePath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Detect class-based handlers
    const classHandlers = detectClassHandlers(content, filePath, lines);
    implementations.push(...classHandlers);

    // Detect function-based handlers
    const functionHandlers = detectFunctionHandlers(content, filePath, lines);
    implementations.push(...functionHandlers);

  } catch {
    // File not readable
  }

  return implementations;
}

/**
 * Detect class-based handlers
 */
function detectClassHandlers(
  content: string,
  filePath: string,
  lines: string[]
): DetectedImplementation[] {
  const implementations: DetectedImplementation[] = [];
  const classPattern = /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = classPattern.exec(content)) !== null) {
    const className = match[1]!;
    const line = getLineNumber(content, match.index);

    // Determine handler type from class name
    const type = determineTypeFromName(className);
    if (type === 'unknown') continue;

    // Find class methods
    const methods = extractClassMethods(content, match.index, lines);

    const impl: DetectedImplementation = {
      id: `handler-${filePath}-${line}`,
      name: className,
      type,
      filePath,
      line,
      endLine: findClassEnd(lines, line - 1),
      functionName: className,
      patterns: detectHandlerPatterns(content, line, lines),
      confidence: calculateHandlerConfidence(className, type, content),
      metadata: {
        classType: type,
        methods: methods.map(m => m.name),
      },
    };

    implementations.push(impl);
  }

  return implementations;
}

/**
 * Detect function-based handlers
 */
function detectFunctionHandlers(
  content: string,
  filePath: string,
  lines: string[]
): DetectedImplementation[] {
  const implementations: DetectedImplementation[] = [];

  // Exported async functions that look like handlers
  const exportedFnPattern = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;

  let match: RegExpExecArray | null;
  while ((match = exportedFnPattern.exec(content)) !== null) {
    const fnName = match[1]!;
    const line = getLineNumber(content, match.index);

    // Check if it looks like a handler
    if (!isHandlerLikeName(fnName)) continue;

    const type = determineTypeFromName(fnName);

    const impl: DetectedImplementation = {
      id: `fn-handler-${filePath}-${line}`,
      name: fnName,
      type: type === 'unknown' ? 'handler' : type,
      filePath,
      line,
      functionName: fnName,
      patterns: detectHandlerPatterns(content, line, lines),
      confidence: 0.5 + (type !== 'unknown' ? 0.2 : 0),
    };

    implementations.push(impl);
  }

  return implementations;
}

/**
 * Determine implementation type from name
 */
function determineTypeFromName(name: string): ImplementationType {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('service')) return 'service';
  if (lowerName.includes('repository')) return 'model';
  if (lowerName.includes('controller')) return 'handler';
  if (lowerName.includes('handler')) return 'handler';
  if (lowerName.includes('usecase')) return 'handler';
  if (lowerName.includes('guard')) return 'guard';
  if (lowerName.includes('middleware')) return 'middleware';

  return 'unknown';
}

/**
 * Check if a function name looks like a handler
 */
function isHandlerLikeName(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.includes('handle') ||
    lowerName.includes('process') ||
    lowerName.includes('execute') ||
    lowerName.includes('create') ||
    lowerName.includes('update') ||
    lowerName.includes('delete') ||
    lowerName.includes('get') ||
    lowerName.includes('find') ||
    lowerName.includes('validate') ||
    lowerName.includes('send') ||
    lowerName.includes('notify')
  );
}

/**
 * Extract methods from a class
 */
function extractClassMethods(
  content: string,
  classStart: number,
  lines: string[]
): Array<{ name: string; line: number }> {
  const methods: Array<{ name: string; line: number }> = [];
  const startLine = getLineNumber(content, classStart);

  // Simple method detection
  const methodPattern = /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/gm;
  const classContent = content.substring(classStart);

  let match: RegExpExecArray | null;
  while ((match = methodPattern.exec(classContent)) !== null) {
    const methodName = match[1]!;
    if (methodName !== 'constructor') {
      methods.push({
        name: methodName,
        line: startLine + getLineNumber(classContent.substring(0, match.index), 0),
      });
    }
  }

  return methods;
}

/**
 * Find end of class
 */
function findClassEnd(lines: string[], startLine: number): number {
  let braceCount = 0;
  let foundStart = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]!;
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundStart = true;
      } else if (char === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          return i + 1;
        }
      }
    }
  }

  return lines.length;
}

/**
 * Detect patterns in handler context
 */
function detectHandlerPatterns(
  content: string,
  line: number,
  lines: string[]
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const contextStart = Math.max(0, line - 1);
  const contextEnd = Math.min(lines.length, line + 100);
  const contextContent = lines.slice(contextStart, contextEnd).join('\n');

  // Validation
  if (/(?:validate|schema|zod|yup|joi|z\.object)/i.test(contextContent)) {
    patterns.push({
      type: 'validation',
      description: 'Input validation present',
      line,
    });
  }

  // Error handling
  if (/(?:try\s*\{|catch\s*\(|\.catch\s*\()/i.test(contextContent)) {
    patterns.push({
      type: 'error-handling',
      description: 'Error handling present',
      line,
    });
  }

  // Logging
  if (/(?:logger\.|console\.|log\s*\()/i.test(contextContent)) {
    patterns.push({
      type: 'logging',
      description: 'Logging present',
      line,
    });
  }

  // Database operations
  if (/(?:prisma|\.findMany|\.findUnique|\.create\(|\.update\(|\.delete\()/i.test(contextContent)) {
    patterns.push({
      type: 'database',
      description: 'Database operations present',
      line,
    });
  }

  // Assertions
  if (/(?:assert|expect|should)/i.test(contextContent)) {
    patterns.push({
      type: 'assertion',
      description: 'Assertions present',
      line,
    });
  }

  return patterns;
}

/**
 * Calculate confidence for handler detection
 */
function calculateHandlerConfidence(
  name: string,
  type: ImplementationType,
  content: string
): number {
  let confidence = 0.5;

  // Known type adds confidence
  if (type !== 'unknown') {
    confidence += 0.2;
  }

  // Exported class adds confidence
  if (/export\s+class/.test(content)) {
    confidence += 0.1;
  }

  // Has methods adds confidence
  if (/(?:async\s+)?\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/.test(content)) {
    confidence += 0.1;
  }

  // Dependency injection adds confidence
  if (/constructor\s*\([^)]+\)/.test(content)) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}
