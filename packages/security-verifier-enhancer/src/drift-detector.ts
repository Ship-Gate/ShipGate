/**
 * Auth Drift Detector
 * Compares ISL auth requirements with observed route implementations
 */

import type {
  ISLAuthRequirement,
  ObservedAuthPolicy,
  AuthDriftClaim,
  AuthDriftResult,
  AuthDriftConfig,
} from './types.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<AuthDriftConfig> = {
  minConfidence: 0.5,
  publicEndpointThreshold: 0.7, // Higher threshold = less likely to flag public endpoints
  includeSnippets: true,
  ignoreDirs: ['node_modules', '.git', 'dist', 'build', '.next'],
  includeExtensions: ['.ts', '.tsx', '.js', '.jsx'],
};

/**
 * Detect auth drift between ISL requirements and observed policies
 */
export function detectAuthDrift(
  islRequirements: ISLAuthRequirement[],
  observedPolicies: ObservedAuthPolicy[],
  config?: AuthDriftConfig
): AuthDriftResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const claims: AuthDriftClaim[] = [];

  // Build route map for quick lookup
  const routeMap = new Map<string, ObservedAuthPolicy[]>();
  for (const policy of observedPolicies) {
    const key = `${policy.httpMethod}:${policy.routePath}`;
    if (!routeMap.has(key)) {
      routeMap.set(key, []);
    }
    routeMap.get(key)!.push(policy);
  }

  // Check each ISL requirement against observed policies
  for (const requirement of islRequirements) {
    // Try to find matching route
    // For now, we'll match by behavior name patterns or route mapping
    // In a real implementation, you'd have a mapping from ISL behaviors to routes
    
    // Find routes that might match this behavior
    const matchingRoutes = findMatchingRoutes(requirement, observedPolicies);
    
    for (const observedPolicy of matchingRoutes) {
      const claim = compareRequirementAndPolicy(requirement, observedPolicy, finalConfig);
      if (claim && claim.confidence >= finalConfig.minConfidence) {
        claims.push(claim);
      }
    }
  }

  // Also check for routes that have auth but shouldn't (extra-auth)
  for (const policy of observedPolicies) {
    // Check if this route has auth but no ISL requirement
    if (policy.enforcementType !== 'none' && policy.confidence > 0.5) {
      const hasMatchingRequirement = islRequirements.some(req => 
        matchesRoute(req, policy)
      );
      
      if (!hasMatchingRequirement) {
        // This might be extra auth, but we need to be careful with public endpoints
        // Only flag if confidence is high that this is NOT a public endpoint
        if (policy.confidence > finalConfig.publicEndpointThreshold) {
          const claim: AuthDriftClaim = {
            id: `extra-auth-${policy.filePath}-${policy.line}`,
            route: policy.routePath,
            method: policy.httpMethod,
            expectedPolicy: {
              behaviorName: 'unknown',
              requirementType: 'public',
              islFilePath: 'unknown',
              line: 0,
              confidence: 0.5,
            },
            observedPolicy: policy,
            driftType: 'extra-auth',
            severity: 'info', // Extra auth is usually less critical
            confidence: policy.confidence * 0.8, // Lower confidence for extra-auth detection
            description: `Route ${policy.httpMethod} ${policy.routePath} has auth enforcement but no ISL requirement`,
            suggestion: 'Consider documenting auth requirement in ISL spec or removing unnecessary auth',
          };
          
          if (claim.confidence >= finalConfig.minConfidence) {
            claims.push(claim);
          }
        }
      }
    }
  }

  // Group claims by severity
  const claimsBySeverity = {
    critical: claims.filter(c => c.severity === 'critical'),
    warning: claims.filter(c => c.severity === 'warning'),
    info: claims.filter(c => c.severity === 'info'),
  };

  return {
    claims,
    claimsBySeverity,
    summary: {
      totalClaims: claims.length,
      criticalCount: claimsBySeverity.critical.length,
      warningCount: claimsBySeverity.warning.length,
      infoCount: claimsBySeverity.info.length,
      routesChecked: observedPolicies.length,
      routesWithDrift: new Set(claims.map(c => `${c.method}:${c.route}`)).size,
    },
  };
}

/**
 * Find routes that might match an ISL requirement
 */
function findMatchingRoutes(
  requirement: ISLAuthRequirement,
  observedPolicies: ObservedAuthPolicy[]
): ObservedAuthPolicy[] {
  // If requirement has route mapping, use it
  if (requirement.routePath && requirement.httpMethod) {
    return observedPolicies.filter(
      p => p.routePath === requirement.routePath && p.httpMethod === requirement.httpMethod
    );
  }

  // Otherwise, try to match by behavior name patterns
  // This is a heuristic - in production, you'd have explicit mappings
  const behaviorNameLower = requirement.behaviorName.toLowerCase();
  
  return observedPolicies.filter(policy => {
    // Check if route path or file path contains behavior name
    const routeLower = policy.routePath.toLowerCase();
    const fileLower = policy.filePath.toLowerCase();
    
    return (
      routeLower.includes(behaviorNameLower) ||
      fileLower.includes(behaviorNameLower) ||
      // Common patterns: Login -> /login, GetUser -> /users/:id
      matchesBehaviorPattern(behaviorNameLower, routeLower)
    );
  });
}

/**
 * Check if route matches behavior name pattern
 */
function matchesBehaviorPattern(behaviorName: string, routePath: string): boolean {
  // Login -> /login, /auth/login
  if (behaviorName.includes('login')) {
    return /\/login|\/auth/.test(routePath);
  }
  
  // GetUser, CreateUser -> /users
  if (behaviorName.includes('user')) {
    return /\/users?/.test(routePath);
  }
  
  // Create, Update, Delete -> POST, PUT, DELETE
  if (behaviorName.includes('create')) {
    return /\/create|POST/.test(routePath);
  }
  
  return false;
}

/**
 * Compare ISL requirement with observed policy
 */
function compareRequirementAndPolicy(
  requirement: ISLAuthRequirement,
  policy: ObservedAuthPolicy,
  config: Required<AuthDriftConfig>
): AuthDriftClaim | null {
  // Case 1: ISL requires auth, but route has none
  if (requirement.requirementType === 'auth' && policy.enforcementType === 'none') {
    return {
      id: `missing-auth-${policy.filePath}-${policy.line}`,
      route: policy.routePath,
      method: policy.httpMethod,
      expectedPolicy: requirement,
      observedPolicy: policy,
      driftType: 'missing-auth',
      severity: 'critical',
      confidence: requirement.confidence * policy.confidence,
      description: `Route ${policy.httpMethod} ${policy.routePath} requires auth per ISL but has no auth enforcement`,
      suggestion: `Add authentication middleware or guard to ${policy.filePath}:${policy.line}`,
    };
  }

  // Case 2: ISL requires role, but route doesn't enforce it
  if (requirement.requirementType === 'role' && requirement.requiredRoles) {
    if (policy.enforcementType === 'none') {
      return {
        id: `missing-role-${policy.filePath}-${policy.line}`,
        route: policy.routePath,
        method: policy.httpMethod,
        expectedPolicy: requirement,
        observedPolicy: policy,
        driftType: 'missing-auth',
        severity: 'critical',
        confidence: requirement.confidence * policy.confidence,
        description: `Route ${policy.httpMethod} ${policy.routePath} requires role(s) ${requirement.requiredRoles.join(', ')} per ISL but has no auth enforcement`,
        suggestion: `Add role-based authorization to ${policy.filePath}:${policy.line}`,
      };
    }
    
    // Check role mismatch
    if (policy.detectedRoles && policy.detectedRoles.length > 0) {
      const roleMismatch = !requirement.requiredRoles.some(reqRole =>
        policy.detectedRoles!.some(obsRole =>
          obsRole.toLowerCase() === reqRole.toLowerCase()
        )
      );
      
      if (roleMismatch) {
        return {
          id: `role-mismatch-${policy.filePath}-${policy.line}`,
          route: policy.routePath,
          method: policy.httpMethod,
          expectedPolicy: requirement,
          observedPolicy: policy,
          driftType: 'role-mismatch',
          severity: 'warning',
          confidence: requirement.confidence * policy.confidence * 0.9,
          description: `Route ${policy.httpMethod} ${policy.routePath} requires role(s) ${requirement.requiredRoles.join(', ')} per ISL but enforces ${policy.detectedRoles.join(', ')}`,
          suggestion: `Update role enforcement to match ISL requirement: ${requirement.requiredRoles.join(', ')}`,
        };
      }
    }
  }

  // Case 3: ISL requires permission, but route doesn't enforce it
  if (requirement.requirementType === 'permission' && requirement.requiredPermissions) {
    if (policy.enforcementType === 'none' || !policy.detectedPermissions || policy.detectedPermissions.length === 0) {
      return {
        id: `missing-permission-${policy.filePath}-${policy.line}`,
        route: policy.routePath,
        method: policy.httpMethod,
        expectedPolicy: requirement,
        observedPolicy: policy,
        driftType: 'missing-auth',
        severity: 'warning',
        confidence: requirement.confidence * policy.confidence,
        description: `Route ${policy.httpMethod} ${policy.routePath} requires permission(s) ${requirement.requiredPermissions.join(', ')} per ISL but has no permission enforcement`,
        suggestion: `Add permission-based authorization to ${policy.filePath}:${policy.line}`,
      };
    }
    
    // Check permission mismatch
    if (policy.detectedPermissions.length > 0) {
      const permMismatch = !requirement.requiredPermissions.some(reqPerm =>
        policy.detectedPermissions!.some(obsPerm =>
          obsPerm.toLowerCase() === reqPerm.toLowerCase()
        )
      );
      
      if (permMismatch) {
        return {
          id: `permission-mismatch-${policy.filePath}-${policy.line}`,
          route: policy.routePath,
          method: policy.httpMethod,
          expectedPolicy: requirement,
          observedPolicy: policy,
          driftType: 'permission-mismatch',
          severity: 'warning',
          confidence: requirement.confidence * policy.confidence * 0.9,
          description: `Route ${policy.httpMethod} ${policy.routePath} requires permission(s) ${requirement.requiredPermissions.join(', ')} per ISL but enforces ${policy.detectedPermissions.join(', ')}`,
          suggestion: `Update permission enforcement to match ISL requirement: ${requirement.requiredPermissions.join(', ')}`,
        };
      }
    }
  }

  // Case 4: ISL marks as public, but route has auth
  if (requirement.requirementType === 'public' && policy.enforcementType !== 'none') {
    // Only flag if confidence is high that this should be public
    if (requirement.confidence > config.publicEndpointThreshold) {
      return {
        id: `extra-auth-public-${policy.filePath}-${policy.line}`,
        route: policy.routePath,
        method: policy.httpMethod,
        expectedPolicy: requirement,
        observedPolicy: policy,
        driftType: 'extra-auth',
        severity: 'info',
        confidence: requirement.confidence * policy.confidence * 0.7, // Lower confidence
        description: `Route ${policy.httpMethod} ${policy.routePath} is marked as public in ISL but has auth enforcement`,
        suggestion: `Consider removing auth enforcement or updating ISL spec if auth is required`,
      };
    }
  }

  // No drift detected
  return null;
}

/**
 * Check if requirement matches route
 */
function matchesRoute(requirement: ISLAuthRequirement, policy: ObservedAuthPolicy): boolean {
  if (requirement.routePath && requirement.httpMethod) {
    return (
      requirement.routePath === policy.routePath &&
      requirement.httpMethod === policy.httpMethod
    );
  }
  
  // Fallback to behavior name matching
  return matchesBehaviorPattern(requirement.behaviorName.toLowerCase(), policy.routePath);
}
