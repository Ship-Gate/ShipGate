// ============================================================================
// Symbol Matcher - Matches ISL symbols to code symbols
// ============================================================================

import type { Binding, CodeSymbol, Evidence, ISLSymbol, DiscoveryStrategy } from './types.js';

/**
 * Match ISL symbols to code symbols using multiple strategies
 */
export function matchSymbols(
  islSymbols: ISLSymbol[],
  codeSymbols: CodeSymbol[],
  options: { minConfidence?: number } = {}
): Binding[] {
  const bindings: Binding[] = [];
  const minConfidence = options.minConfidence || 0.3;

  for (const islSymbol of islSymbols) {
    const candidates: Array<{ codeSymbol: CodeSymbol; confidence: number; evidence: Evidence[]; strategy: DiscoveryStrategy }> = [];

    for (const codeSymbol of codeSymbols) {
      // Try different matching strategies
      const nameMatch = matchByName(islSymbol, codeSymbol);
      if (nameMatch.confidence >= minConfidence) {
        candidates.push(nameMatch);
      }

      const pathMatch = matchByPath(islSymbol, codeSymbol);
      if (pathMatch.confidence >= minConfidence) {
        candidates.push(pathMatch);
      }

      const routeMatch = matchByRoute(islSymbol, codeSymbol);
      if (routeMatch.confidence >= minConfidence) {
        candidates.push(routeMatch);
      }

      const namingConventionMatch = matchByNamingConvention(islSymbol, codeSymbol);
      if (namingConventionMatch.confidence >= minConfidence) {
        candidates.push(namingConventionMatch);
      }
    }

    // Select best match (highest confidence)
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.confidence - a.confidence);
      const best = candidates[0]!;

      bindings.push({
        islSymbol,
        codeSymbol: best.codeSymbol,
        confidence: best.confidence,
        evidence: best.evidence,
        strategy: best.strategy,
      });
    }
  }

  return bindings;
}

/**
 * Match by exact or similar name
 */
function matchByName(islSymbol: ISLSymbol, codeSymbol: CodeSymbol): {
  codeSymbol: CodeSymbol;
  confidence: number;
  evidence: Evidence[];
  strategy: DiscoveryStrategy;
} {
  const evidence: Evidence[] = [];
  let confidence = 0;

  const islName = islSymbol.name.toLowerCase();
  const codeName = codeSymbol.name.toLowerCase();

  // Exact match
  if (islName === codeName) {
    confidence = 0.95;
    evidence.push({
      type: 'name_match',
      description: `Exact name match: ${islSymbol.name} = ${codeSymbol.name}`,
      confidence: 0.95,
    });
  }
  // Case-insensitive match
  else if (islSymbol.name.toLowerCase() === codeSymbol.name.toLowerCase()) {
    confidence = 0.85;
    evidence.push({
      type: 'name_match',
      description: `Case-insensitive name match: ${islSymbol.name} = ${codeSymbol.name}`,
      confidence: 0.85,
    });
  }
  // Partial match (e.g., "CreateUser" matches "createUser" or "create_user")
  else if (
    normalizeName(islName) === normalizeName(codeName) ||
    islName.includes(codeName) ||
    codeName.includes(islName)
  ) {
    confidence = 0.65;
    evidence.push({
      type: 'name_match',
      description: `Partial name match: ${islSymbol.name} ≈ ${codeSymbol.name}`,
      confidence: 0.65,
    });
  }
  // CamelCase/PascalCase variations
  else if (areNameVariations(islName, codeName)) {
    confidence = 0.70;
    evidence.push({
      type: 'naming_convention',
      description: `Name variation match: ${islSymbol.name} ≈ ${codeSymbol.name}`,
      confidence: 0.70,
    });
  }

  return {
    codeSymbol,
    confidence,
    evidence,
    strategy: 'naming_conventions',
  };
}

/**
 * Match by file path patterns
 */
function matchByPath(islSymbol: ISLSymbol, codeSymbol: CodeSymbol): {
  codeSymbol: CodeSymbol;
  confidence: number;
  evidence: Evidence[];
  strategy: DiscoveryStrategy;
} {
  const evidence: Evidence[] = [];
  let confidence = 0;

  const islName = islSymbol.name.toLowerCase();
  const codeFile = codeSymbol.file.toLowerCase();

  // Check if file path contains behavior/entity name
  if (codeFile.includes(islName)) {
    confidence = 0.60;
    evidence.push({
      type: 'path_match',
      description: `File path contains symbol name: ${codeSymbol.file}`,
      confidence: 0.60,
    });
  }

  // Check for common patterns: routes/{name}.ts, handlers/{name}.ts, etc.
  const pathPatterns = [
    new RegExp(`(?:routes?|handlers?|controllers?|services?)/(?:${islName}|${islName.replace(/([A-Z])/g, '-$1').toLowerCase()})`, 'i'),
  ];

  for (const pattern of pathPatterns) {
    if (pattern.test(codeFile)) {
      confidence = Math.max(confidence, 0.75);
      evidence.push({
        type: 'path_match',
        description: `File path matches pattern: ${codeSymbol.file}`,
        confidence: 0.75,
        details: { pattern: pattern.toString() },
      });
      break;
    }
  }

  return {
    codeSymbol,
    confidence,
    evidence,
    strategy: 'filesystem_heuristics',
  };
}

/**
 * Match behavior to route (e.g., "Login" -> POST /api/login)
 */
function matchByRoute(islSymbol: ISLSymbol, codeSymbol: CodeSymbol): {
  codeSymbol: CodeSymbol;
  confidence: number;
  evidence: Evidence[];
  strategy: DiscoveryStrategy;
} {
  const evidence: Evidence[] = [];
  let confidence = 0;

  // Only match behaviors to routes
  if (islSymbol.type !== 'behavior' || codeSymbol.type !== 'route') {
    return { codeSymbol, confidence: 0, evidence, strategy: 'route_matching' };
  }

  const islName = islSymbol.name.toLowerCase();
  const routePath = (codeSymbol.metadata?.path as string)?.toLowerCase() || '';
  const routeMethod = (codeSymbol.metadata?.method as string)?.toUpperCase() || '';

  // Check if route path contains behavior name
  if (routePath.includes(islName)) {
    confidence = 0.80;
    evidence.push({
      type: 'route_matching',
      description: `Route path contains behavior name: ${routeMethod} ${routePath}`,
      confidence: 0.80,
    });
  }

  // Common patterns: CreateUser -> POST /api/users, GetUser -> GET /api/users/:id
  const normalizedName = normalizeName(islName);
  if (normalizedName.startsWith('create') && routeMethod === 'POST' && routePath.includes('users')) {
    confidence = Math.max(confidence, 0.85);
    evidence.push({
      type: 'route_matching',
      description: `Create pattern match: POST route for create operation`,
      confidence: 0.85,
    });
  } else if (normalizedName.startsWith('get') && routeMethod === 'GET') {
    confidence = Math.max(confidence, 0.80);
    evidence.push({
      type: 'route_matching',
      description: `Get pattern match: GET route for read operation`,
      confidence: 0.80,
    });
  } else if (normalizedName.startsWith('update') && routeMethod === 'PUT' || routeMethod === 'PATCH') {
    confidence = Math.max(confidence, 0.80);
    evidence.push({
      type: 'route_matching',
      description: `Update pattern match: ${routeMethod} route for update operation`,
      confidence: 0.80,
    });
  } else if (normalizedName.startsWith('delete') && routeMethod === 'DELETE') {
    confidence = Math.max(confidence, 0.85);
    evidence.push({
      type: 'route_matching',
      description: `Delete pattern match: DELETE route for delete operation`,
      confidence: 0.85,
    });
  }

  return {
    codeSymbol,
    confidence,
    evidence,
    strategy: 'route_matching',
  };
}

/**
 * Match by naming conventions (camelCase, snake_case, etc.)
 */
function matchByNamingConvention(islSymbol: ISLSymbol, codeSymbol: CodeSymbol): {
  codeSymbol: CodeSymbol;
  confidence: number;
  evidence: Evidence[];
  strategy: DiscoveryStrategy;
} {
  const evidence: Evidence[] = [];
  let confidence = 0;

  const islName = normalizeName(islSymbol.name.toLowerCase());
  const codeName = normalizeName(codeSymbol.name.toLowerCase());

  // Check if names are variations of each other
  if (areNameVariations(islName, codeName)) {
    confidence = 0.70;
    evidence.push({
      type: 'naming_convention',
      description: `Naming convention match: ${islSymbol.name} ≈ ${codeSymbol.name}`,
      confidence: 0.70,
    });
  }

  return {
    codeSymbol,
    confidence,
    evidence,
    strategy: 'naming_conventions',
  };
}

/**
 * Normalize name for comparison (remove special chars, convert to lowercase)
 */
function normalizeName(name: string): string {
  return name
    .replace(/[-_]/g, '')
    .replace(/([A-Z])/g, (_, c) => c.toLowerCase())
    .toLowerCase();
}

/**
 * Check if two names are variations (e.g., "CreateUser" vs "createUser" vs "create_user")
 */
function areNameVariations(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return true;

  // Check if one contains the other (e.g., "createuser" contains "create")
  if (n1.length > 3 && n2.length > 3) {
    if (n1.includes(n2) || n2.includes(n1)) {
      return true;
    }
  }

  return false;
}
