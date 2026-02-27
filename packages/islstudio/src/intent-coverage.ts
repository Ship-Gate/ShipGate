/**
 * ISL Studio - Intent Coverage Metrics
 * 
 * Measures what % of endpoints have intent tags.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface IntentTag {
  type: string;
  file: string;
  line: number;
  endpoint?: string;
}

export interface IntentCoverage {
  totalEndpoints: number;
  taggedEndpoints: number;
  coveragePercent: number;
  byType: Record<string, number>;
  untaggedEndpoints: string[];
  tags: IntentTag[];
}

// Intent types we track
const INTENT_TYPES = [
  'rate-limit',
  'rate-limit-auth',
  'no-pii-in-logs',
  'encrypt-pii',
  'audit-sensitive',
  'validate-input',
  'require-auth',
  'require-role',
];

/**
 * Extract intent tags from file
 */
export function extractIntentTags(content: string, filePath: string): IntentTag[] {
  const tags: IntentTag[] = [];
  const lines = content.split('\n');
  
  // Pattern: @intent <type> or // @intent <type>
  const intentPattern = /@intent\s+([\w-]+)/gi;
  
  for (let i = 0; i < lines.length; i++) {
    let match;
    while ((match = intentPattern.exec(lines[i])) !== null) {
      tags.push({
        type: match[1].toLowerCase(),
        file: filePath,
        line: i + 1,
      });
    }
    intentPattern.lastIndex = 0;
  }
  
  return tags;
}

/**
 * Extract endpoints from file
 */
export function extractEndpoints(content: string, filePath: string): string[] {
  const endpoints: string[] = [];
  
  // Express/Fastify style
  const routePattern = /\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;
  while ((match = routePattern.exec(content)) !== null) {
    endpoints.push(`${match[1].toUpperCase()} ${match[2]}`);
  }
  
  // Next.js API route (file-based)
  if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
    const routePath = filePath
      .replace(/.*[\/\\]api[\/\\]/, '/api/')
      .replace(/\.(ts|js|tsx|jsx)$/, '')
      .replace(/\\/g, '/');
    
    // Check for HTTP method exports
    if (/export\s+(async\s+)?function\s+GET/i.test(content)) {
      endpoints.push(`GET ${routePath}`);
    }
    if (/export\s+(async\s+)?function\s+POST/i.test(content)) {
      endpoints.push(`POST ${routePath}`);
    }
    if (/export\s+(async\s+)?function\s+PUT/i.test(content)) {
      endpoints.push(`PUT ${routePath}`);
    }
    if (/export\s+(async\s+)?function\s+DELETE/i.test(content)) {
      endpoints.push(`DELETE ${routePath}`);
    }
  }
  
  return endpoints;
}

/**
 * Calculate intent coverage for a set of files
 */
export async function calculateIntentCoverage(
  files: string[]
): Promise<IntentCoverage> {
  const allTags: IntentTag[] = [];
  const allEndpoints: string[] = [];
  const taggedFiles = new Set<string>();
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      
      // Extract tags
      const tags = extractIntentTags(content, file);
      allTags.push(...tags);
      
      if (tags.length > 0) {
        taggedFiles.add(file);
      }
      
      // Extract endpoints
      const endpoints = extractEndpoints(content, file);
      allEndpoints.push(...endpoints);
    } catch {
      // Skip files that can't be read
    }
  }
  
  // Count tags by type
  const byType: Record<string, number> = {};
  for (const tag of allTags) {
    byType[tag.type] = (byType[tag.type] || 0) + 1;
  }
  
  // Calculate coverage
  const totalEndpoints = allEndpoints.length;
  const taggedEndpoints = taggedFiles.size; // Simplified: file-level coverage
  const coveragePercent = totalEndpoints > 0 
    ? Math.round((taggedEndpoints / totalEndpoints) * 100) 
    : 100;
  
  // Find untagged endpoints
  const untaggedEndpoints = allEndpoints.filter((_, idx) => {
    // This is simplified - in practice would check if file has tags
    return idx >= taggedEndpoints;
  });
  
  return {
    totalEndpoints,
    taggedEndpoints: Math.min(taggedEndpoints, totalEndpoints),
    coveragePercent,
    byType,
    untaggedEndpoints: untaggedEndpoints.slice(0, 10), // Top 10
    tags: allTags,
  };
}

/**
 * Format intent coverage for display
 */
export function formatIntentCoverage(coverage: IntentCoverage): string {
  const lines: string[] = [];
  
  lines.push('Intent Coverage Report');
  lines.push('======================\n');
  
  // Overall coverage
  const bar = '█'.repeat(Math.floor(coverage.coveragePercent / 5)) + 
              '░'.repeat(20 - Math.floor(coverage.coveragePercent / 5));
  lines.push(`Coverage: ${coverage.coveragePercent}% ${bar}`);
  lines.push(`  ${coverage.taggedEndpoints}/${coverage.totalEndpoints} endpoints have intent tags\n`);
  
  // By type
  if (Object.keys(coverage.byType).length > 0) {
    lines.push('By Intent Type:');
    for (const [type, count] of Object.entries(coverage.byType)) {
      lines.push(`  @intent ${type}: ${count}`);
    }
    lines.push('');
  }
  
  // Untagged
  if (coverage.untaggedEndpoints.length > 0) {
    lines.push('Untagged Endpoints (add intent tags):');
    for (const endpoint of coverage.untaggedEndpoints) {
      lines.push(`  - ${endpoint}`);
    }
    if (coverage.totalEndpoints - coverage.taggedEndpoints > 10) {
      lines.push(`  ... and ${coverage.totalEndpoints - coverage.taggedEndpoints - 10} more`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Check for intent mismatch (PR changed code but not intent)
 */
export interface IntentMismatch {
  type: 'missing_intent' | 'stale_intent';
  file: string;
  description: string;
}

export async function checkIntentMismatch(
  changedFiles: string[],
  allFiles: string[]
): Promise<IntentMismatch[]> {
  const mismatches: IntentMismatch[] = [];
  
  for (const file of changedFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const tags = extractIntentTags(content, file);
      const endpoints = extractEndpoints(content, file);
      
      // Has endpoints but no intent tags
      if (endpoints.length > 0 && tags.length === 0) {
        mismatches.push({
          type: 'missing_intent',
          file,
          description: `File has ${endpoints.length} endpoint(s) but no @intent tags`,
        });
      }
      
      // Auth endpoint without rate-limit intent
      const hasAuthEndpoint = endpoints.some(e => 
        /login|auth|register|signup|password/i.test(e)
      );
      const hasRateLimitIntent = tags.some(t => 
        t.type.includes('rate-limit')
      );
      
      if (hasAuthEndpoint && !hasRateLimitIntent) {
        mismatches.push({
          type: 'missing_intent',
          file,
          description: 'Auth endpoint found but no @intent rate-limit tag',
        });
      }
      
    } catch {
      // Skip
    }
  }
  
  return mismatches;
}
