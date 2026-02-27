/**
 * Auth Detector V2
 *
 * Enhanced detection of authentication and authorization patterns
 * with risk flag detection for common security issues.
 */

import type {
  DetectorResult,
  DetectedCandidate,
  RiskFlag,
  FrameworkHint,
  AuditOptionsV2,
} from '../types.js';

/**
 * Auth patterns to detect
 */
const AUTH_PATTERNS = {
  // Session management
  session: {
    pattern: /(?:req\.session|ctx\.session|getSession|useSession|getServerSession|session\s*\()/gi,
    confidence: 0.85,
    subCategory: 'session',
  },
  // JWT/Token verification
  jwt: {
    pattern: /(?:verifyToken|jwt\.verify|validateToken|decodeToken|verifyJwt|jsonwebtoken)/gi,
    confidence: 0.9,
    subCategory: 'jwt',
  },
  // Auth middleware patterns
  middleware: {
    pattern: /(?:isAuthenticated|requireAuth|authGuard|authenticate|withAuth|protectRoute|@UseGuards)/gi,
    confidence: 0.9,
    subCategory: 'middleware',
  },
  // Role/permission checks
  rbac: {
    pattern: /(?:hasRole|hasPermission|checkRole|requireRole|authorize|can\s*\(|ability\.can|@Roles|@Permissions)/gi,
    confidence: 0.85,
    subCategory: 'rbac',
  },
  // User context retrieval
  userContext: {
    pattern: /(?:currentUser|getCurrentUser|getUser|req\.user|ctx\.user|session\.user|@CurrentUser)/gi,
    confidence: 0.7,
    subCategory: 'user-context',
  },
  // Auth providers
  authProvider: {
    pattern: /(?:ClerkProvider|SessionProvider|AuthProvider|Auth0Provider|NextAuthProvider|auth\(\))/gi,
    confidence: 0.8,
    subCategory: 'provider',
  },
  // Login/logout handlers
  loginLogout: {
    pattern: /(?:signIn|signOut|login|logout|handleLogin|handleLogout|createSession|destroySession)/gi,
    confidence: 0.8,
    subCategory: 'login-logout',
  },
  // Password operations
  password: {
    pattern: /(?:hashPassword|comparePassword|bcrypt|argon2|scrypt|pbkdf2|hash\s*\(|compare\s*\()/gi,
    confidence: 0.85,
    subCategory: 'password',
  },
  // OAuth patterns
  oauth: {
    pattern: /(?:oauth|OAuth|authorize|callback|accessToken|refreshToken|@AuthGuard\s*\(\s*['"`]oauth)/gi,
    confidence: 0.8,
    subCategory: 'oauth',
  },
  // API key auth
  apiKey: {
    pattern: /(?:apiKey|api[_-]?key|x-api-key|authorization:\s*['"`]?Bearer|@ApiKey)/gi,
    confidence: 0.75,
    subCategory: 'api-key',
  },
};

/**
 * Detect auth patterns in file content
 */
export function detectAuth(
  content: string,
  filePath: string,
  options: AuditOptionsV2
): DetectorResult {
  const candidates: DetectedCandidate[] = [];
  const riskFlags: RiskFlag[] = [];
  const frameworkHints: Set<FrameworkHint> = new Set();
  const lines = content.split('\n');

  // Track detected ranges to avoid duplicates
  const detectedRanges: Set<string> = new Set();

  for (const [patternName, patternConfig] of Object.entries(AUTH_PATTERNS)) {
    const { pattern, confidence, subCategory } = patternConfig;
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      const rangeKey = `${filePath}:${line}`;

      // Skip if confidence below threshold or already detected
      if (confidence < (options.minConfidence ?? 0.4)) continue;
      if (detectedRanges.has(rangeKey)) continue;

      detectedRanges.add(rangeKey);

      const fnName = extractFunctionName(lines, line - 1);
      const name = fnName || `Auth: ${subCategory}`;

      const candidate: DetectedCandidate = {
        id: `auth-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}-${line}`,
        category: 'auth',
        name,
        filePath,
        line,
        endLine: findFunctionEnd(lines, line - 1),
        snippet: options.includeSnippets
          ? extractSnippet(lines, line - 1, options.maxSnippetLines ?? 10)
          : undefined,
        confidence,
        functionName: fnName,
        metadata: {
          patternType: patternName,
          subCategory,
          matchedText: match[0],
        },
      };

      candidates.push(candidate);

      // Check for auth-related risk flags
      const contextContent = extractContext(lines, line - 1, 30);
      const authRisks = detectAuthRisks(
        contextContent,
        candidate,
        filePath,
        line,
        subCategory
      );
      riskFlags.push(...authRisks);
    }
  }

  // Detect framework from auth providers
  if (/ClerkProvider|clerk/i.test(content)) {
    frameworkHints.add('nextjs-app');
  }
  if (/NextAuthProvider|next-auth/i.test(content)) {
    frameworkHints.add('nextjs-pages');
  }

  return {
    candidates,
    riskFlags,
    frameworkHints: Array.from(frameworkHints),
  };
}

/**
 * Detect auth-related risk flags
 */
function detectAuthRisks(
  contextContent: string,
  candidate: DetectedCandidate,
  filePath: string,
  line: number,
  subCategory: string
): RiskFlag[] {
  const risks: RiskFlag[] = [];

  // Check for auth without rate limiting (for login handlers)
  if (subCategory === 'login-logout' || subCategory === 'password') {
    const hasRateLimit =
      /(?:rateLimit|rate[_-]?limit|throttle|@Throttle|limiter)/i.test(contextContent);

    if (!hasRateLimit) {
      risks.push({
        id: `risk-auth-no-rate-limit-${candidate.id}`,
        category: 'auth-without-rate-limit',
        severity: 'warning',
        description: `Auth handler ${candidate.name} has no visible rate limiting`,
        filePath,
        line,
        suggestion: 'Add rate limiting to prevent brute force attacks',
        relatedCandidates: [candidate.id],
      });
    }
  }

  // Check for hardcoded secrets
  if (/(?:secret|password|key)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i.test(contextContent)) {
    risks.push({
      id: `risk-hardcoded-secret-${candidate.id}`,
      category: 'hardcoded-secret',
      severity: 'critical',
      description: `Possible hardcoded secret detected near ${candidate.name}`,
      filePath,
      line,
      suggestion: 'Use environment variables for sensitive values',
      relatedCandidates: [candidate.id],
    });
  }

  return risks;
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Extract function name near a line
 */
function extractFunctionName(lines: string[], lineIndex: number): string | undefined {
  for (let i = lineIndex; i >= Math.max(0, lineIndex - 5); i--) {
    const line = lines[i] || '';
    const match = line.match(/(?:function|const|let|async function)\s+(\w+)/);
    if (match) {
      return match[1];
    }
    // Also check for method definitions
    const methodMatch = line.match(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{?$/);
    if (methodMatch && methodMatch[1] !== 'if' && methodMatch[1] !== 'for' && methodMatch[1] !== 'while') {
      return methodMatch[1];
    }
  }
  return undefined;
}

/**
 * Find end of function
 */
function findFunctionEnd(lines: string[], startLineIndex: number): number {
  let braceCount = 0;
  let foundStart = false;

  for (let i = startLineIndex; i < Math.min(lines.length, startLineIndex + 100); i++) {
    const line = lines[i] || '';
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

  return Math.min(startLineIndex + 30, lines.length);
}

/**
 * Extract code snippet
 */
function extractSnippet(
  lines: string[],
  startLineIndex: number,
  maxLines: number
): string {
  const endIndex = Math.min(startLineIndex + maxLines, lines.length);
  return lines.slice(startLineIndex, endIndex).join('\n');
}

/**
 * Extract context around a line
 */
function extractContext(
  lines: string[],
  lineIndex: number,
  contextSize: number
): string {
  const start = Math.max(0, lineIndex - 5);
  const end = Math.min(lines.length, lineIndex + contextSize);
  return lines.slice(start, end).join('\n');
}

/**
 * Check if a file is likely to contain auth logic
 */
export function isAuthFile(filePath: string): boolean {
  const authPatterns = [
    /auth/i,
    /login/i,
    /session/i,
    /middleware/i,
    /guard/i,
    /protect/i,
    /security/i,
    /permission/i,
    /role/i,
  ];

  return authPatterns.some(p => p.test(filePath));
}
