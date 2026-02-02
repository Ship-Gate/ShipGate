/**
 * ISL Firewall - Claim Extractor
 * 
 * Extracts verifiable claims from AI-generated content.
 * 
 * @module @isl-lang/firewall
 */

import * as crypto from 'crypto';
import type { Claim, ClaimType } from './types.js';

/**
 * Claim extraction result with statistics
 */
export interface ExtractionResult {
  claims: Claim[];
  statistics: {
    totalClaims: number;
    byType: Record<ClaimType, number>;
    avgConfidence: number;
  };
}

/**
 * Extracts verifiable claims from code content
 */
export class ClaimExtractor {
  /**
   * Extract all claims from content
   */
  async extract(content: string, filePath = 'unknown'): Promise<Claim[]> {
    const claims: Claim[] = [];

    claims.push(...this.extractImports(content, filePath));
    claims.push(...this.extractFunctionCalls(content, filePath));
    claims.push(...this.extractApiEndpoints(content, filePath));
    claims.push(...this.extractEnvVariables(content, filePath));
    claims.push(...this.extractFileReferences(content, filePath));
    claims.push(...this.extractPackageDependencies(content, filePath));

    return claims;
  }

  /**
   * Extract with full statistics
   */
  async extractWithStats(content: string, filePath = 'unknown'): Promise<ExtractionResult> {
    const claims = await this.extract(content, filePath);
    
    const byType: Record<ClaimType, number> = {
      import: 0,
      function_call: 0,
      type_reference: 0,
      api_endpoint: 0,
      env_variable: 0,
      file_reference: 0,
      package_dependency: 0,
    };

    let totalConfidence = 0;
    for (const claim of claims) {
      byType[claim.type]++;
      totalConfidence += claim.confidence;
    }

    return {
      claims,
      statistics: {
        totalClaims: claims.length,
        byType,
        avgConfidence: claims.length > 0 ? totalConfidence / claims.length : 0,
      },
    };
  }

  private extractImports(content: string, filePath: string): Claim[] {
    const claims: Claim[] = [];
    const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      claims.push(this.createClaim('import', match[1], match.index, content, filePath));
    }

    return claims;
  }

  private extractFunctionCalls(content: string, filePath: string): Claim[] {
    const claims: Claim[] = [];
    const regex = /(\w+)\s*\(/g;
    const keywords = new Set(['if', 'while', 'for', 'switch', 'catch', 'function', 'return', 'new', 'typeof', 'instanceof']);

    let match;
    while ((match = regex.exec(content)) !== null) {
      const funcName = match[1];
      if (!keywords.has(funcName)) {
        claims.push(this.createClaim('function_call', funcName, match.index, content, filePath));
      }
    }

    return claims;
  }

  private extractApiEndpoints(content: string, filePath: string): Claim[] {
    const claims: Claim[] = [];
    const endpointRegex = /['"`](\/api\/[^'"`]+)['"`]/g;
    
    let match;
    while ((match = endpointRegex.exec(content)) !== null) {
      claims.push(this.createClaim('api_endpoint', match[1], match.index, content, filePath));
    }

    return claims;
  }

  private extractEnvVariables(content: string, filePath: string): Claim[] {
    const claims: Claim[] = [];
    const envRegex = /process\.env\.(\w+)|import\.meta\.env\.(\w+)/g;
    
    let match;
    while ((match = envRegex.exec(content)) !== null) {
      const varName = match[1] || match[2];
      claims.push(this.createClaim('env_variable', varName, match.index, content, filePath));
    }

    return claims;
  }

  private extractFileReferences(content: string, filePath: string): Claim[] {
    const claims: Claim[] = [];
    const fileRegex = /['"`](\.\.?\/[^'"`]+\.[a-z]+)['"`]/gi;
    
    let match;
    while ((match = fileRegex.exec(content)) !== null) {
      claims.push(this.createClaim('file_reference', match[1], match.index, content, filePath));
    }

    return claims;
  }

  private extractPackageDependencies(content: string, filePath: string): Claim[] {
    const claims: Claim[] = [];
    const importRegex = /from\s+['"]([^./][^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      claims.push(this.createClaim('package_dependency', match[1], match.index, content, filePath));
    }

    return claims;
  }

  private createClaim(
    type: ClaimType,
    value: string,
    index: number,
    content: string,
    filePath: string
  ): Claim {
    const lines = content.slice(0, index).split('\n');
    const line = lines.length;
    const column = (lines[lines.length - 1]?.length ?? 0) + 1;

    return {
      id: this.generateClaimId(type, filePath, line, column, value),
      type,
      value,
      location: { line, column, length: value.length },
      confidence: 0.8,
      context: content.slice(Math.max(0, index - 50), index + value.length + 50),
    };
  }

  private generateClaimId(
    type: string,
    filePath: string,
    line: number,
    column: number,
    value: string
  ): string {
    const data = `${type}:${filePath}:${line}:${column}:${value}`;
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 12);
  }
}

/**
 * Create a claim extractor instance
 */
export function createClaimExtractor(): ClaimExtractor {
  return new ClaimExtractor();
}
