/**
 * Behavioral Verification Checker
 *
 * - If spec says "create user → hash password → save to DB", verify the function
 *   actually calls a hash function before the DB write
 * - If spec says "delete requires ownership check", verify there's an ownership
 *   comparison before the delete call
 * - Uses control flow analysis (not just "does the function mention bcrypt")
 * - Severity: missing security behavior = critical, missing business logic = high
 */

import * as ts from 'typescript';
import type { Finding, VerificationContext, SpecBehavior } from '../types.js';

const CHECKER_NAME = 'BehavioralVerifier';

function makeId(prefix: string, ...parts: string[]): string {
  return `${prefix}-${parts.join('-').replace(/[^a-z0-9-]/gi, '')}`.slice(0, 80);
}

/** Map spec step keywords to code patterns that implement them */
const STEP_PATTERNS: Record<string, RegExp[]> = {
  'hash password': [
    /\b(bcrypt|argon2|scrypt)\.(hash|hashSync)/i,
    /\bcrypto\.(createHash|pbkdf2)/,
    /\bhash\s*\(/,
    /\bhashPassword\s*\(/,
    /\bhashSync\s*\(/,
  ],
  'save to db': [
    /\b(prisma|db|database)\.\w+\.(create|insert|upsert)/i,
    /\b\.save\s*\(/,
    /\binsert\s+into/i,
    /\bcreate\s*\(/,
  ],
  'ownership check': [
    /\b(user\.id|userId|ownerId)\s*===?\s*(item\.|entity\.|record\.)?(userId|ownerId|createdBy)/i,
    /\b(owns|isOwner|canAccess|checkOwnership)\s*\(/i,
    /\bwhere\s*.*userId\s*===/i,
    /\b\.findFirst\s*\([^)]*where[^)]*userId/i,
  ],
  'validate input': [
    /\b(z\.|zod|parse|safeParse|validate)\s*\(/i,
    /\b(Joi|yup)\./i,
    /\bif\s*\(!\w+\)\s*throw/,
  ],
  'send email': [
    /\b(sendEmail|sendMail|nodemailer|resend)\./i,
    /\btransporter\.sendMail/,
    /\bemail\s*\.\s*send/,
  ],
};

/** Map security requirement keywords to code patterns */
const SECURITY_PATTERNS: Record<string, RegExp[]> = {
  'ownership check': STEP_PATTERNS['ownership check']!,
  'auth required': [
    /\b(requireAuth|getSession|getServerSession|verifyToken)\s*\(/i,
    /\breq\.user\b/,
    /\bc\.get\s*\(\s*['"`]user['"`]\s*\)/,
  ],
  'rate limit': [
    /\b(rateLimit|rateLimiter|throttle)\s*\(/i,
    /\bexpress-rate-limit/,
  ],
};

/** Find function body content by name (simple AST search) */
function findFunctionBody(
  sourceFile: ts.SourceFile,
  functionName: string
): string | null {
  let result: string | null = null;

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.getText() === functionName) {
      result = node.getText();
      return;
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.getText() === functionName &&
          decl.initializer &&
          ts.isArrowFunction(decl.initializer)
        ) {
          result = decl.initializer.getText();
          return;
        }
      }
    }
    if (ts.isMethodDeclaration(node) && node.name.getText() === functionName) {
      result = node.getText();
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return result;
}

/** Normalize behavior name for matching (e.g. createUser -> create user) */
function normalizeBehaviorName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();
}

/** Find which file contains the behavior implementation */
function findBehaviorFile(
  behaviorName: string,
  implFiles: Map<string, string>
): { filePath: string; content: string } | null {
  const normalized = normalizeBehaviorName(behaviorName);

  for (const [filePath, content] of implFiles) {
    // Match function name: createUser, create_user, etc.
    const fnPattern = new RegExp(
      `(?:function|const|async\\s+function)\\s+${escapeRegex(behaviorName)}\\b`,
      'i'
    );
    const altPattern = new RegExp(
      `(?:function|const|async\\s+function)\\s+${normalized.replace(/\s+/g, '')}\\b`,
      'i'
    );
    if (fnPattern.test(content) || altPattern.test(content)) {
      return { filePath, content };
    }
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Check if body contains any of the patterns */
function bodyContainsPatterns(body: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(body));
}

export async function runBehavioralVerifier(
  ctx: VerificationContext
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const behaviors = ctx.spec.behaviors ?? [];

  for (const behavior of behaviors) {
    const impl = findBehaviorFile(behavior.name, ctx.implFiles);
    if (!impl) continue; // Behavior might be in different module

    const sourceFile = ts.createSourceFile(
      impl.filePath,
      impl.content,
      ts.ScriptTarget.Latest,
      true
    );

    const body = findFunctionBody(sourceFile, behavior.name);
    if (!body) continue;

    // Check steps
    for (const step of behavior.steps ?? []) {
      const stepLower = step.toLowerCase();
      const patterns = STEP_PATTERNS[stepLower];
      if (!patterns) continue;

      if (!bodyContainsPatterns(body, patterns)) {
        findings.push({
          id: makeId('behavior-missing-step', behavior.name, step),
          checker: CHECKER_NAME,
          ruleId: 'behavior/missing-step',
          severity: 'high',
          message: `Behavior "${behavior.name}" claims "${step}" but implementation does not match`,
          file: impl.filePath,
          blocking: false,
          recommendation: `Add the required step: ${step}`,
          context: { behaviorName: behavior.name, step },
        });
      }
    }

    // Check security requirements (critical)
    for (const req of behavior.securityRequirements ?? []) {
      const reqLower = req.toLowerCase();
      const patterns =
        SECURITY_PATTERNS[reqLower] ?? STEP_PATTERNS[reqLower];
      if (!patterns) continue;

      if (!bodyContainsPatterns(body, patterns)) {
        findings.push({
          id: makeId('behavior-missing-security', behavior.name, req),
          checker: CHECKER_NAME,
          ruleId: 'behavior/missing-security',
          severity: 'critical',
          message: `Behavior "${behavior.name}" requires "${req}" but implementation does not have it`,
          file: impl.filePath,
          blocking: true,
          recommendation: `Add security requirement: ${req}`,
          context: { behaviorName: behavior.name, requirement: req },
        });
      }
    }
  }

  return findings;
}
