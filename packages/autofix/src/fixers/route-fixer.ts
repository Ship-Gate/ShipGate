/**
 * Dead / Hallucinated Route Fixer
 * 
 * Replaces dead route references with closest match or adds TODO annotation.
 */

import type { Finding } from '@isl-lang/gate';
import type { FixContext, ShipgateFixSuggestion } from '../shipgate-fixes.js';
import { readFileSafe } from '../shipgate-fixes.js';
import { createPatch } from '../patcher.js';

/**
 * Extract route path from finding message
 */
function extractRoutePath(finding: Finding): { path: string; method?: string } | null {
  // Try to extract from message patterns like:
  // "Route /api/users not found"
  // "Dead route reference: GET /api/auth/login"
  // "Hallucinated route: POST /api/payments"
  const patterns = [
    /route[:\s]+['"]?([^\s'"]+)['"]?/i,
    /['"]?([\/][^\s'"]*)['"]?\s+not found/i,
    /(GET|POST|PUT|DELETE|PATCH)\s+['"]?([\/][^\s'"]*)['"]?/i,
  ];

  for (const pattern of patterns) {
    const match = finding.message.match(pattern);
    if (match) {
      if (match[2]) {
        // Method + path
        return { path: match[2], method: match[1] };
      } else if (match[1] && match[1].startsWith('/')) {
        // Just path
        return { path: match[1] };
      }
    }
  }

  return null;
}

/**
 * Find closest matching route
 */
function findClosestRoute(
  routePath: string,
  method: string | undefined,
  truthpackRoutes: Array<{ path: string; method: string }>
): { path: string; method: string; confidence: number } | null {
  if (truthpackRoutes.length === 0) {
    return null;
  }

  // Simple path similarity (Levenshtein-like)
  let bestMatch: { path: string; method: string; confidence: number } | null = null;
  let bestScore = 0;

  for (const route of truthpackRoutes) {
    // Method match bonus
    const methodMatch = !method || route.method.toUpperCase() === method.toUpperCase();
    
    // Path similarity
    const pathSimilarity = calculatePathSimilarity(routePath, route.path);
    
    // Combined score
    const score = methodMatch ? pathSimilarity * 1.2 : pathSimilarity;
    
    if (score > bestScore && score > 0.5) {
      bestScore = score;
      bestMatch = {
        path: route.path,
        method: route.method,
        confidence: Math.min(score, 0.9),
      };
    }
  }

  return bestMatch;
}

/**
 * Calculate path similarity (0-1)
 */
function calculatePathSimilarity(path1: string, path2: string): number {
  // Normalize paths
  const p1 = path1.split('/').filter(Boolean);
  const p2 = path2.split('/').filter(Boolean);

  if (p1.length === 0 && p2.length === 0) return 1.0;
  if (p1.length === 0 || p2.length === 0) return 0.0;

  // Count matching segments
  let matches = 0;
  const minLen = Math.min(p1.length, p2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (p1[i] === p2[i]) {
      matches++;
    } else if (p1[i]?.includes(':') || p2[i]?.includes(':')) {
      // Parameter segments count as partial match
      matches += 0.5;
    }
  }

  return matches / Math.max(p1.length, p2.length);
}

/**
 * Find route reference in file content
 */
function findRouteReference(
  content: string,
  routePath: string,
  _method?: string
): { line: number; column?: number; original: string } | null {
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    
    // Check for route path in string literals
    if (line.includes(routePath)) {
      // Try to find the full expression
      const patterns = [
        new RegExp(`['"]${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
        new RegExp(`\`[^\`]*${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\`]*\``, 'g'),
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          return {
            line: i + 1,
            column: line.indexOf(match[0]!),
            original: match[0]!,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Generate fix suggestions for dead route
 */
export async function fixDeadRoute(
  finding: Finding,
  context: FixContext
): Promise<ShipgateFixSuggestion[]> {
  const suggestions: ShipgateFixSuggestion[] = [];
  const routeInfo = extractRoutePath(finding);

  if (!routeInfo) {
    return [];
  }

  const { path: routePath, method } = routeInfo;
  const { projectRoot, truthpack } = context;

  // Try to find closest match
  const closestMatch = truthpack?.routes
    ? findClosestRoute(routePath, method, truthpack.routes)
    : null;

  // Find file and line
  const file = finding.file;
  if (!file) {
    return [];
  }

  const content = await readFileSafe(file, projectRoot);
  if (!content) {
    return [];
  }

  const routeRef = findRouteReference(content, routePath, method);
  if (!routeRef) {
    return [];
  }

  // Option 1: Replace with closest match (high confidence)
  if (closestMatch && closestMatch.confidence >= 0.7) {
    const replacement = `'${closestMatch.path}'`;
    const newContent = content.replace(routeRef.original, replacement);

    const patch = createPatch('replace', routeRef.line, {
      file,
      original: routeRef.original,
      replacement,
      description: `Replace dead route ${routePath} with closest match ${closestMatch.path}`,
      confidence: closestMatch.confidence,
    });

    suggestions.push({
      rule: 'dead-route',
      why: `Route ${routePath} not found. Replacing with closest match: ${closestMatch.path}`,
      confidence: closestMatch.confidence,
      patch,
      diff: generateDiff(file, content, newContent),
    });
  } else {
    // Option 2: Add TODO annotation (lower confidence)
    const todoComment = `// TODO: Route ${method ? method + ' ' : ''}${routePath} not found. Verify route exists or update reference.\n`;
    const lines = content.split('\n');
    const insertLine = routeRef.line;

    const patch = createPatch('insert', insertLine, {
      file,
      content: todoComment,
      description: `Add TODO comment for dead route reference ${routePath}`,
      confidence: 0.6,
    });

    const newContent = [
      ...lines.slice(0, insertLine - 1),
      todoComment.trim(),
      ...lines.slice(insertLine - 1),
    ].join('\n');

    suggestions.push({
      rule: 'dead-route',
      why: `Route ${routePath} not found. Adding TODO annotation for manual review.`,
      confidence: 0.6,
      patch,
      diff: generateDiff(file, content, newContent),
    });
  }

  return suggestions;
}

/**
 * Generate unified diff
 */
function generateDiff(
  file: string,
  oldContent: string,
  newContent: string
): string {
  const { generateUnifiedDiff } = require('../diff-generator.js');
  return generateUnifiedDiff(file, oldContent, newContent);
}
