/**
 * Security Checker
 *
 * Evaluates whether security concerns are addressed in the spec:
 * - Auth behaviors have rate limiting
 * - Password handling requires hashing
 * - API endpoints require auth
 * - Error messages are consistent (no info leakage)
 * - Token handling has expiry requirements
 */

import type { Domain, Behavior, SecuritySpec } from '@isl-lang/parser';
import type {
  DimensionChecker,
  DimensionCheckResult,
  QualitySuggestion,
} from '../types.js';

// ============================================================================
// Pattern detection
// ============================================================================

const AUTH_PATTERNS = /(auth|login|signin|signup|register|authenticate)/i;
const PASSWORD_PATTERNS = /(password|passwd|credential|secret)/i;
const TOKEN_PATTERNS = /(token|jwt|session|apikey|api_key|access_token|refresh_token)/i;
const API_PATTERNS = /(api|endpoint|route|handler|controller)/i;
const SENSITIVE_DATA = /(email|ssn|credit_card|phone|address|dob|date_of_birth)/i;

function behaviorNameMatches(name: string, pattern: RegExp): boolean {
  return pattern.test(name);
}

function hasSecurityType(specs: SecuritySpec[], type: string): boolean {
  return specs.some(s => s.type === type);
}

// ============================================================================
// Check functions
// ============================================================================

function checkRateLimiting(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;
    if (!behaviorNameMatches(name, AUTH_PATTERNS)) continue;

    const hasRateLimit = hasSecurityType(b.security, 'rate_limit');

    if (!hasRateLimit) {
      penalty += 15;
      suggestions.push({
        dimension: 'security',
        severity: 'critical',
        message: `Auth behavior '${name}' has no rate limiting`,
        example: `security {\n  rate_limit 5 per 1.minutes by input.ip\n}`,
      });
    } else {
      findings.push(`${name}: rate limiting defined`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkPasswordHashing(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;

    // Check if any input field involves passwords
    const hasPasswordInput = b.input?.fields.some(
      f => PASSWORD_PATTERNS.test(f.name.name),
    );
    if (!hasPasswordInput) continue;

    // Look for hashing mention in postconditions or security specs
    const allPredicateText = b.postconditions
      .flatMap(pc => pc.predicates)
      .map(p => JSON.stringify(p))
      .join(' ');

    const mentionsHashing = /hash|bcrypt|scrypt|argon2|pbkdf2/i.test(allPredicateText);
    const hasSecurityReq = b.security.length > 0;

    if (!mentionsHashing && !hasSecurityReq) {
      penalty += 15;
      suggestions.push({
        dimension: 'security',
        severity: 'critical',
        message: `Behavior '${name}' handles passwords but has no hashing requirement`,
        example: `postconditions {\n  on success {\n    stored_password == hash(input.password, "bcrypt")\n  }\n}`,
      });
    } else {
      findings.push(`${name}: password hashing addressed`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkAuthRequirements(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  // Count behaviors that have auth vs those that don't
  const nonAuthBehaviors = behaviors.filter(
    b => !behaviorNameMatches(b.name.name, AUTH_PATTERNS),
  );

  for (const b of nonAuthBehaviors) {
    const name = b.name.name;
    const hasAuthRequirement = hasSecurityType(b.security, 'requires');
    const hasActors = b.actors && b.actors.length > 0;

    if (!hasAuthRequirement && !hasActors) {
      // Only penalize if the domain has auth behaviors (implying auth is relevant)
      const domainHasAuth = behaviors.some(
        ob => behaviorNameMatches(ob.name.name, AUTH_PATTERNS),
      );
      if (domainHasAuth) {
        penalty += 5;
        suggestions.push({
          dimension: 'security',
          severity: 'warning',
          message: `Behavior '${name}' has no auth requirement`,
          example: `security {\n  requires authenticated_user\n}`,
        });
      }
    } else if (hasAuthRequirement || hasActors) {
      findings.push(`${name}: auth requirement defined`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkErrorMessageConsistency(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  // Check that auth-related errors don't leak information
  for (const b of behaviors) {
    const name = b.name.name;
    if (!behaviorNameMatches(name, AUTH_PATTERNS)) continue;

    const errors = b.output?.errors ?? [];
    const hasSpecificAuthErrors = errors.some(e => {
      const errName = e.name.name.toLowerCase();
      return (
        errName.includes('invalid_password') ||
        errName.includes('invalidpassword') ||
        errName.includes('user_not_found') ||
        errName.includes('usernotfound') ||
        errName.includes('wrong_password') ||
        errName.includes('wrongpassword') ||
        errName.includes('no_such_user') ||
        errName.includes('nosuchuser')
      );
    });

    if (hasSpecificAuthErrors) {
      penalty += 10;
      suggestions.push({
        dimension: 'security',
        severity: 'warning',
        message: `Behavior '${name}' error names may leak auth information — use generic error names`,
        example: `errors {\n  InvalidCredentials when "email or password is incorrect"\n}`,
      });
    } else if (errors.length > 0) {
      findings.push(`${name}: error message consistency maintained`);
    }
  }

  return { findings, suggestions, penalty };
}

function checkTokenExpiry(
  behaviors: Behavior[],
): { findings: string[]; suggestions: QualitySuggestion[]; penalty: number } {
  const findings: string[] = [];
  const suggestions: QualitySuggestion[] = [];
  let penalty = 0;

  for (const b of behaviors) {
    const name = b.name.name;

    // Check if behavior outputs or mentions tokens
    const outputText = JSON.stringify(b.output ?? {});
    const mentionsToken = TOKEN_PATTERNS.test(name) || TOKEN_PATTERNS.test(outputText);

    if (!mentionsToken) continue;

    // Check for expiry in postconditions
    const allPredicateText = b.postconditions
      .flatMap(pc => pc.predicates)
      .map(p => JSON.stringify(p))
      .join(' ');

    const mentionsExpiry = /expir|ttl|valid_until|expires_at|lifetime/i.test(allPredicateText);
    const hasTemporal = b.temporal && b.temporal.length > 0;

    if (!mentionsExpiry && !hasTemporal) {
      penalty += 10;
      suggestions.push({
        dimension: 'security',
        severity: 'warning',
        message: `Behavior '${name}' handles tokens but has no expiry requirement`,
        example: `postconditions {\n  on success {\n    result.token.expires_at > now()\n    result.token.expires_at <= now() + 24.hours\n  }\n}`,
      });
    } else {
      findings.push(`${name}: token expiry addressed`);
    }
  }

  return { findings, suggestions, penalty };
}

// ============================================================================
// Checker
// ============================================================================

export const securityChecker: DimensionChecker = {
  dimension: 'security',

  check(domain: Domain, file: string): DimensionCheckResult {
    const allFindings: string[] = [];
    const allSuggestions: QualitySuggestion[] = [];
    let totalPenalty = 0;

    // If there are no behaviors, security is N/A — give full marks
    if (domain.behaviors.length === 0) {
      return {
        score: { score: 100, findings: ['No behaviors to evaluate'] },
        suggestions: [],
      };
    }

    const checks = [
      checkRateLimiting(domain.behaviors),
      checkPasswordHashing(domain.behaviors),
      checkAuthRequirements(domain.behaviors),
      checkErrorMessageConsistency(domain.behaviors),
      checkTokenExpiry(domain.behaviors),
    ];

    for (const c of checks) {
      allFindings.push(...c.findings);
      allSuggestions.push(...c.suggestions);
      totalPenalty += c.penalty;
    }

    // If no security-sensitive behaviors found, give a baseline score
    if (allFindings.length === 0 && allSuggestions.length === 0) {
      allFindings.push('No security-sensitive behaviors detected');
      return {
        score: { score: 80, findings: allFindings },
        suggestions: [],
      };
    }

    const score = Math.max(0, Math.min(100, 100 - totalPenalty));

    return {
      score: { score, findings: allFindings },
      suggestions: allSuggestions,
    };
  },
};
