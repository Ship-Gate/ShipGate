import ts from 'typescript';
import type { SecurityFinding } from '../verification/types.js';

const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /sk_live_[A-Za-z0-9]{20,}/, label: 'Stripe secret key' },
  { pattern: /sk_test_[A-Za-z0-9]{20,}/, label: 'Stripe test key' },
  { pattern: /ghp_[A-Za-z0-9]{36,}/, label: 'GitHub personal access token' },
  { pattern: /gho_[A-Za-z0-9]{36,}/, label: 'GitHub OAuth token' },
  { pattern: /ghs_[A-Za-z0-9]{36,}/, label: 'GitHub App token' },
  { pattern: /AKIA[A-Z0-9]{16}/, label: 'AWS access key ID' },
  { pattern: /xoxb-[0-9]+-[A-Za-z0-9]+/, label: 'Slack bot token' },
  { pattern: /xoxp-[0-9]+-[A-Za-z0-9]+/, label: 'Slack user token' },
  { pattern: /AIza[A-Za-z0-9_-]{35}/, label: 'Google API key' },
  { pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/, label: 'Private key' },
  { pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, label: 'JWT token' },
  { pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/, label: 'SendGrid API key' },
  { pattern: /sq0csp-[A-Za-z0-9_-]{43}/, label: 'Square access token' },
];

export interface FoldedConstant {
  value: string;
  node: ts.Node;
  sourceFile: ts.SourceFile;
}

export function foldConstants(
  program: ts.Program,
  files: ts.SourceFile[],
): SecurityFinding[] {
  const checker = program.getTypeChecker();
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const sf of files) {
    visitNode(sf);

    function visitNode(node: ts.Node): void {
      const folded = tryFold(node, sf, checker);
      if (folded !== undefined) {
        for (const sp of SECRET_PATTERNS) {
          if (sp.pattern.test(folded)) {
            counter++;
            const { line, character } = sf.getLineAndCharacterOfPosition(
              node.getStart(sf),
            );
            findings.push({
              id: `DEEP-CONST-${String(counter).padStart(3, '0')}`,
              title: `Obfuscated secret detected: ${sp.label}`,
              severity: 'critical',
              file: sf.fileName,
              line: line + 1,
              column: character + 1,
              description:
                `Constant folding resolved an expression to a value matching the ` +
                `pattern for ${sp.label}. The secret may be split, reversed, or ` +
                `base64-encoded to evade simple string scanning.`,
              recommendation:
                'Move secrets to environment variables or a vault. ' +
                'Never embed secrets in source code, even in obfuscated form.',
              snippet: node.getText(sf).slice(0, 200),
            });
            break;
          }
        }
      }

      ts.forEachChild(node, visitNode);
    }
  }

  return findings;
}

export function tryFold(
  node: ts.Node,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isTemplateExpression(node)) {
    return foldTemplate(node, sf, checker);
  }

  // "a" + "b" concatenation
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = tryFold(node.left, sf, checker);
    const right = tryFold(node.right, sf, checker);
    if (left !== undefined && right !== undefined) return left + right;
    return undefined;
  }

  // String.fromCharCode(115, 107, ...)
  if (ts.isCallExpression(node)) {
    return foldCallExpression(node, sf, checker);
  }

  // Parenthesized expressions
  if (ts.isParenthesizedExpression(node)) {
    return tryFold(node.expression, sf, checker);
  }

  // Try type-level resolution for const-typed variables
  const type = checker.getTypeAtLocation(node);
  if (type.isStringLiteral()) {
    return type.value;
  }

  return undefined;
}

function foldTemplate(
  node: ts.TemplateExpression,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
): string | undefined {
  let result = node.head.text;
  for (const span of node.templateSpans) {
    const value = tryFold(span.expression, sf, checker);
    if (value === undefined) return undefined;
    result += value + span.literal.text;
  }
  return result;
}

function foldCallExpression(
  node: ts.CallExpression,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
): string | undefined {
  const calleeText = node.expression.getText(sf);

  // String.fromCharCode(n1, n2, ...)
  if (calleeText === 'String.fromCharCode') {
    const charCodes: number[] = [];
    for (const arg of node.arguments) {
      const num = foldNumeric(arg, sf, checker);
      if (num === undefined) return undefined;
      charCodes.push(num);
    }
    return String.fromCharCode(...charCodes);
  }

  // Buffer.from("base64str", "base64").toString()  — handled as chained call
  // First check if this is a .toString() call on a Buffer.from result
  if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'toString') {
    const inner = node.expression.expression;
    if (ts.isCallExpression(inner)) {
      const innerCallee = inner.expression.getText(sf);
      if (innerCallee === 'Buffer.from' && inner.arguments.length >= 2) {
        const data = tryFold(inner.arguments[0], sf, checker);
        const encoding = tryFold(inner.arguments[1], sf, checker);
        if (data !== undefined && encoding === 'base64') {
          try {
            return Buffer.from(data, 'base64').toString();
          } catch {
            return undefined;
          }
        }
        if (data !== undefined && encoding === 'hex') {
          try {
            return Buffer.from(data, 'hex').toString();
          } catch {
            return undefined;
          }
        }
      }
    }
  }

  // "reversed".split("").reverse().join("")
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'join' &&
    node.arguments.length === 1
  ) {
    const joinSep = tryFold(node.arguments[0], sf, checker);
    if (joinSep === undefined) return undefined;

    const reverseCall = node.expression.expression;
    if (
      ts.isCallExpression(reverseCall) &&
      ts.isPropertyAccessExpression(reverseCall.expression) &&
      reverseCall.expression.name.text === 'reverse' &&
      reverseCall.arguments.length === 0
    ) {
      const splitCall = reverseCall.expression.expression;
      if (
        ts.isCallExpression(splitCall) &&
        ts.isPropertyAccessExpression(splitCall.expression) &&
        splitCall.expression.name.text === 'split' &&
        splitCall.arguments.length === 1
      ) {
        const splitSep = tryFold(splitCall.arguments[0], sf, checker);
        const original = tryFold(splitCall.expression.expression, sf, checker);
        if (original !== undefined && splitSep !== undefined) {
          return original.split(splitSep).reverse().join(joinSep);
        }
      }
    }
  }

  // atob("base64str")
  if (calleeText === 'atob' && node.arguments.length === 1) {
    const encoded = tryFold(node.arguments[0], sf, checker);
    if (encoded !== undefined) {
      try {
        return Buffer.from(encoded, 'base64').toString();
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function foldNumeric(
  node: ts.Node,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
): number | undefined {
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const operand = foldNumeric(node.operand, sf, checker);
    return operand !== undefined ? -operand : undefined;
  }

  if (ts.isParenthesizedExpression(node)) {
    return foldNumeric(node.expression, sf, checker);
  }

  const type = checker.getTypeAtLocation(node);
  if (type.isNumberLiteral()) {
    return type.value;
  }

  return undefined;
}
