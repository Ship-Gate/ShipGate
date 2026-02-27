// ============================================================================
// Input Validation Prover - Main prover class
// ============================================================================

import type {
  EndpointInfo,
  ValidationEvidence,
  InputValidationPropertyProof,
  Finding,
  PropertyStatus,
} from './types.js';
import { detectValidation } from './detectors.js';
import {
  traceFieldAccesses,
  extractFieldNames,
  findValidationLine,
  isValidationBeforeLogic,
  isValidationInCatchBlock,
} from './field-tracer.js';
import {
  checkCompleteness,
  analyzeConstraintQuality,
  generateFindings,
  acceptsInput,
  extractValidatedFields,
} from './analyzer.js';

/**
 * Input Validation Prover
 * Proves that endpoints validate inputs before processing
 */
export class InputValidationProver {
  private endpoints: EndpointInfo[] = [];
  private evidence: ValidationEvidence[] = [];
  private findings: Finding[] = [];

  /**
   * Analyze a source file for input validation
   */
  analyzeFile(filePath: string, sourceCode: string): void {
    // Discover endpoints in the file
    const endpoints = this.discoverEndpoints(filePath, sourceCode);

    for (const endpoint of endpoints) {
      const handlerCode = this.extractHandlerCode(sourceCode, endpoint);
      const evidence = this.analyzeEndpoint(endpoint, handlerCode);
      
      if (evidence) {
        this.evidence.push(evidence);
      }
    }
  }

  /**
   * Discover endpoints in source code
   */
  private discoverEndpoints(filePath: string, code: string): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];

    // Express-style: app.post('/route', handler)
    const expressRegex = /(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s+)?\(?\s*(?:req|request)\s*,\s*(?:res|response)/g;
    let match;

    while ((match = expressRegex.exec(code)) !== null) {
      const methodMatch = match[1];
      const routeMatch = match[2];
      if (!methodMatch || !routeMatch) continue;
      const method = methodMatch.toUpperCase();
      const route = routeMatch;
      const line = code.substring(0, match.index).split('\n').length;

      endpoints.push({
        route,
        method,
        file: filePath,
        line,
        handlerStart: match.index,
        handlerEnd: this.findHandlerEnd(code, match.index),
        acceptsInput: acceptsInput(method) || route.includes(':'),
        inputSources: this.detectInputSources(method, route),
      });
    }

    // Fastify-style: fastify.post('/route', { schema }, handler)
    const fastifyRegex = /(?:fastify|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = fastifyRegex.exec(code)) !== null) {
      const methodMatch = match[1];
      const routeMatch = match[2];
      if (!methodMatch || !routeMatch) continue;
      const method = methodMatch.toUpperCase();
      const route = routeMatch;
      const line = code.substring(0, match.index).split('\n').length;

      endpoints.push({
        route,
        method,
        file: filePath,
        line,
        handlerStart: match.index,
        handlerEnd: this.findHandlerEnd(code, match.index),
        acceptsInput: acceptsInput(method) || route.includes(':'),
        inputSources: this.detectInputSources(method, route),
      });
    }

    // Next.js API routes: export async function POST(request)
    const nextApiRegex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(\s*(?:req|request)/g;
    while ((match = nextApiRegex.exec(code)) !== null) {
      const methodMatch = match[1];
      if (!methodMatch) continue;
      const method = methodMatch;
      const route = this.extractNextApiRoute(filePath);
      const line = code.substring(0, match.index).split('\n').length;

      endpoints.push({
        route,
        method,
        file: filePath,
        line,
        handlerStart: match.index,
        handlerEnd: this.findHandlerEnd(code, match.index),
        acceptsInput: acceptsInput(method),
        inputSources: this.detectInputSources(method, route),
      });
    }

    return endpoints;
  }

  /**
   * Find the end of a handler function
   */
  private findHandlerEnd(code: string, startIndex: number): number {
    let braceDepth = 0;
    let foundFirstBrace = false;

    for (let i = startIndex; i < code.length; i++) {
      if (code[i] === '{') {
        braceDepth++;
        foundFirstBrace = true;
      } else if (code[i] === '}') {
        braceDepth--;
        if (foundFirstBrace && braceDepth === 0) {
          return i;
        }
      }
    }

    return code.length;
  }

  /**
   * Extract handler code
   */
  private extractHandlerCode(code: string, endpoint: EndpointInfo): string {
    return code.substring(endpoint.handlerStart, endpoint.handlerEnd);
  }

  /**
   * Extract Next.js API route from file path
   */
  private extractNextApiRoute(filePath: string): string {
    const match = filePath.match(/\/api\/(.+?)\/route\.(ts|js)/);
    if (match) {
      return `/api/${match[1]}`;
    }
    return '/api/unknown';
  }

  /**
   * Detect which input sources are used
   */
  private detectInputSources(method: string, route: string): Array<'body' | 'params' | 'query' | 'headers'> {
    const sources: Array<'body' | 'params' | 'query' | 'headers'> = [];

    if (acceptsInput(method)) {
      sources.push('body');
    }

    if (route.includes(':') || route.includes('[')) {
      sources.push('params');
    }

    // Query params are always possible
    sources.push('query');

    return sources;
  }

  /**
   * Analyze a single endpoint
   */
  private analyzeEndpoint(endpoint: EndpointInfo, handlerCode: string): ValidationEvidence | null {
    // Skip endpoints that don't accept input
    if (!endpoint.acceptsInput) {
      return null;
    }

    // Detect validation
    const schema = detectValidation(handlerCode, endpoint.line);

    // Trace field accesses
    const accesses = traceFieldAccesses(handlerCode, endpoint.line);
    const accessedFields = extractFieldNames(accesses);

    // Extract validated fields
    const validatedFields = extractValidatedFields(schema);

    // Check completeness
    const unvalidatedFields = checkCompleteness(validatedFields, accessedFields);

    // Find validation line
    const validationLine = schema ? schema.line : findValidationLine(handlerCode, endpoint.line);

    // Check validation placement
    const validationBeforeLogic = isValidationBeforeLogic(
      validationLine,
      endpoint.line,
      endpoint.line + handlerCode.split('\n').length
    );

    // Check if in catch block (anti-pattern)
    const inCatchBlock = isValidationInCatchBlock(handlerCode, validationLine);

    // Analyze constraint quality
    const constraintQuality = analyzeConstraintQuality(schema);

    // Generate findings
    const findings = generateFindings(
      endpoint.file,
      endpoint.route,
      schema,
      unvalidatedFields,
      validationBeforeLogic && !inCatchBlock,
      accessedFields
    );

    this.findings.push(...findings);

    return {
      route: endpoint.route,
      file: endpoint.file,
      line: endpoint.line,
      method: endpoint.method,
      hasValidation: schema !== null,
      validationLibrary: schema?.library || null,
      validationLine,
      validatedFields,
      accessedFields,
      unvalidatedFields,
      validationBeforeLogic: validationBeforeLogic && !inCatchBlock,
      constraintQuality,
    };
  }

  /**
   * Generate property proof
   */
  prove(): InputValidationPropertyProof {
    const startTime = Date.now();

    // Calculate statistics
    const totalEndpoints = this.evidence.length;
    const validatedEndpoints = this.evidence.filter(e => 
      e.hasValidation && e.unvalidatedFields.length === 0 && e.validationBeforeLogic
    ).length;
    const partiallyValidatedEndpoints = this.evidence.filter(e => 
      e.hasValidation && (e.unvalidatedFields.length > 0 || !e.validationBeforeLogic)
    ).length;
    const unvalidatedEndpoints = this.evidence.filter(e => !e.hasValidation).length;
    const endpointsWithStrictValidation = this.evidence.filter(e => 
      e.constraintQuality === 'strict'
    ).length;

    // Determine status
    let status: PropertyStatus;
    if (totalEndpoints === 0) {
      status = 'PROVEN'; // No endpoints to validate
    } else if (validatedEndpoints === totalEndpoints) {
      status = 'PROVEN';
    } else if (unvalidatedEndpoints === totalEndpoints) {
      status = 'FAILED';
    } else {
      status = 'PARTIAL';
    }

    // Generate summary
    const summary = this.generateSummary(
      totalEndpoints,
      validatedEndpoints,
      partiallyValidatedEndpoints,
      unvalidatedEndpoints
    );

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low';
    if (totalEndpoints === 0 || validatedEndpoints / totalEndpoints >= 0.9) {
      confidence = 'high';
    } else if (validatedEndpoints / totalEndpoints >= 0.5) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      property: 'input-validation',
      status,
      summary,
      evidence: this.evidence,
      findings: this.findings,
      method: 'static-ast-analysis',
      confidence,
      duration_ms: Date.now() - startTime,
      stats: {
        totalEndpoints,
        validatedEndpoints,
        partiallyValidatedEndpoints,
        unvalidatedEndpoints,
        endpointsWithStrictValidation,
      },
    };
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    total: number,
    validated: number,
    partial: number,
    unvalidated: number
  ): string {
    if (total === 0) {
      return 'No input-accepting endpoints found';
    }

    if (validated === total) {
      return `All ${total} endpoint(s) validate input before processing`;
    }

    if (unvalidated === total) {
      return `All ${total} endpoint(s) process unvalidated input`;
    }

    const parts: string[] = [];
    if (validated > 0) {
      parts.push(`${validated} fully validated`);
    }
    if (partial > 0) {
      parts.push(`${partial} partially validated`);
    }
    if (unvalidated > 0) {
      parts.push(`${unvalidated} unvalidated`);
    }

    return `${total} endpoint(s): ${parts.join(', ')}`;
  }

  /**
   * Reset prover state
   */
  reset(): void {
    this.endpoints = [];
    this.evidence = [];
    this.findings = [];
  }
}

/**
 * Convenience function to prove input validation for a single file
 */
export function proveInputValidation(
  filePath: string,
  sourceCode: string
): InputValidationPropertyProof {
  const prover = new InputValidationProver();
  prover.analyzeFile(filePath, sourceCode);
  return prover.prove();
}

/**
 * Convenience function to prove input validation for multiple files
 */
export function proveInputValidationMultiple(
  files: Array<{ path: string; code: string }>
): InputValidationPropertyProof {
  const prover = new InputValidationProver();
  
  for (const file of files) {
    prover.analyzeFile(file.path, file.code);
  }
  
  return prover.prove();
}
