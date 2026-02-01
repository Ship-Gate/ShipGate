/**
 * Auth Detector for Audit
 *
 * Detects authentication and authorization patterns in the workspace.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DetectedImplementation, DetectedPattern } from '../auditTypes.js';

/**
 * Auth-related patterns to detect
 */
const AUTH_PATTERNS = {
  // Session/cookie checks
  sessionCheck: [
    /(?:req\.session|ctx\.session|getSession|useSession|getServerSession)/gi,
  ],
  // Token verification
  tokenVerify: [
    /(?:verifyToken|jwt\.verify|validateToken|decodeToken|verifyJwt)/gi,
  ],
  // Auth middleware
  authMiddleware: [
    /(?:isAuthenticated|requireAuth|authGuard|authenticate|withAuth|protectRoute)/gi,
  ],
  // Role/permission checks
  roleCheck: [
    /(?:hasRole|hasPermission|checkRole|requireRole|authorize|can\s*\(|ability\.can)/gi,
  ],
  // User context
  userContext: [
    /(?:currentUser|getCurrentUser|getUser|req\.user|ctx\.user|session\.user)/gi,
  ],
  // Auth providers
  authProvider: [
    /(?:ClerkProvider|SessionProvider|AuthProvider|Auth0Provider|NextAuthProvider)/gi,
  ],
  // Login/logout
  loginLogout: [
    /(?:signIn|signOut|login|logout|handleLogin|handleLogout)/gi,
  ],
  // Password operations
  passwordOps: [
    /(?:hashPassword|comparePassword|bcrypt|argon2|scrypt|pbkdf2)/gi,
  ],
};

/**
 * Files that typically contain auth logic
 */
const AUTH_FILE_PATTERNS = [
  /auth/i,
  /login/i,
  /session/i,
  /middleware/i,
  /guard/i,
  /protect/i,
];

/**
 * Detect auth patterns in a single file
 */
export async function detectAuthInFile(
  workspacePath: string,
  filePath: string
): Promise<DetectedImplementation[]> {
  const implementations: DetectedImplementation[] = [];
  const fullPath = path.join(workspacePath, filePath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Track detected line ranges to avoid duplicates
    const detectedRanges: Array<{ start: number; end: number }> = [];

    for (const [category, patterns] of Object.entries(AUTH_PATTERNS)) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(content)) !== null) {
          const line = getLineNumber(content, match.index);

          // Skip if already detected in this range
          if (detectedRanges.some(r => line >= r.start && line <= r.end)) {
            continue;
          }

          // Find function boundaries
          const fnBoundaries = findFunctionBoundaries(lines, line - 1);
          detectedRanges.push(fnBoundaries);

          const impl: DetectedImplementation = {
            id: `auth-${filePath}-${line}`,
            name: extractAuthName(content, match.index, category),
            type: determineAuthType(category),
            filePath,
            line,
            endLine: fnBoundaries.end,
            functionName: extractFunctionName(lines, line - 1),
            patterns: extractAuthPatterns(content, fnBoundaries, lines),
            confidence: calculateAuthConfidence(category, content, match),
            metadata: {
              category,
              matchedText: match[0],
            },
          };

          implementations.push(impl);
        }
      }
    }

  } catch {
    // File not readable
  }

  return implementations;
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Find function boundaries around a line
 */
function findFunctionBoundaries(
  lines: string[],
  lineIndex: number
): { start: number; end: number } {
  let start = lineIndex;
  let end = lineIndex;

  // Find start (look for function/const declaration)
  for (let i = lineIndex; i >= 0; i--) {
    if (/^\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+\w+/.test(lines[i]!)) {
      start = i + 1;
      break;
    }
    if (/^\s*(?:@\w+|\/\*\*)/.test(lines[i]!)) {
      // Decorator or JSDoc, keep going
      continue;
    }
  }

  // Find end (count braces)
  let braceCount = 0;
  let foundStart = false;
  for (let i = start - 1; i < lines.length; i++) {
    const line = lines[i]!;
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundStart = true;
      } else if (char === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          end = i + 1;
          return { start, end };
        }
      }
    }
  }

  return { start, end: Math.min(start + 50, lines.length) };
}

/**
 * Extract auth function name
 */
function extractAuthName(content: string, index: number, category: string): string {
  // Look for function name nearby
  const nearby = content.substring(Math.max(0, index - 100), index + 100);
  const fnMatch = nearby.match(/(?:function|const|let)\s+(\w+)/);
  
  if (fnMatch) {
    return fnMatch[1]!;
  }

  // Fallback to category-based name
  const categoryNames: Record<string, string> = {
    sessionCheck: 'Session Check',
    tokenVerify: 'Token Verification',
    authMiddleware: 'Auth Middleware',
    roleCheck: 'Role/Permission Check',
    userContext: 'User Context',
    authProvider: 'Auth Provider',
    loginLogout: 'Login/Logout Handler',
    passwordOps: 'Password Operation',
  };

  return categoryNames[category] || 'Auth Check';
}

/**
 * Determine implementation type from category
 */
function determineAuthType(category: string): 'guard' | 'middleware' | 'handler' | 'service' {
  switch (category) {
    case 'authMiddleware':
      return 'middleware';
    case 'roleCheck':
      return 'guard';
    case 'loginLogout':
    case 'passwordOps':
      return 'handler';
    default:
      return 'service';
  }
}

/**
 * Extract function name from lines
 */
function extractFunctionName(lines: string[], lineIndex: number): string | undefined {
  for (let i = lineIndex; i >= Math.max(0, lineIndex - 5); i--) {
    const match = lines[i]!.match(/(?:function|const|let)\s+(\w+)/);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Extract auth-related patterns from function context
 */
function extractAuthPatterns(
  content: string,
  boundaries: { start: number; end: number },
  lines: string[]
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const contextLines = lines.slice(boundaries.start - 1, boundaries.end);
  const contextContent = contextLines.join('\n');

  // Check for various auth patterns
  if (/throw\s+(?:new\s+)?(?:UnauthorizedError|AuthError|Error\s*\(\s*['"`](?:unauthorized|not authenticated))/i.test(contextContent)) {
    patterns.push({
      type: 'auth-check',
      description: 'Throws on unauthorized access',
      line: boundaries.start,
    });
  }

  if (/(?:res\.status\s*\(\s*401|return\s+.*401|ctx\.status\s*=\s*401)/i.test(contextContent)) {
    patterns.push({
      type: 'auth-check',
      description: 'Returns 401 on auth failure',
      line: boundaries.start,
    });
  }

  if (/(?:role|permission|ability|can\s*\()/i.test(contextContent)) {
    patterns.push({
      type: 'auth-check',
      description: 'Role/permission-based access control',
      line: boundaries.start,
    });
  }

  if (/(?:token|jwt|bearer)/i.test(contextContent)) {
    patterns.push({
      type: 'auth-check',
      description: 'Token-based authentication',
      line: boundaries.start,
    });
  }

  if (/(?:session|cookie)/i.test(contextContent)) {
    patterns.push({
      type: 'auth-check',
      description: 'Session/cookie-based authentication',
      line: boundaries.start,
    });
  }

  return patterns;
}

/**
 * Calculate confidence for auth detection
 */
function calculateAuthConfidence(
  category: string,
  content: string,
  match: RegExpExecArray
): number {
  let confidence = 0.6;

  // Higher confidence for explicit auth patterns
  if (['authMiddleware', 'tokenVerify', 'roleCheck'].includes(category)) {
    confidence += 0.2;
  }

  // Check for auth-related imports
  if (/import.*(?:auth|session|jwt|clerk|nextauth)/i.test(content)) {
    confidence += 0.1;
  }

  // Check for auth-related file path
  if (/(?:auth|middleware|guard|protect)/i.test(match.input || '')) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Check if a file is likely to contain auth logic
 */
export function isLikelyAuthFile(filePath: string): boolean {
  return AUTH_FILE_PATTERNS.some(pattern => pattern.test(filePath));
}
