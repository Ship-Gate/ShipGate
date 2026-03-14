import ts from 'typescript';
import type { SecurityFinding, SecuritySeverity } from '../verification/types.js';

type SinkKind = 'xss' | 'sql-injection' | 'command-injection' | 'path-traversal' | 'ssrf' | 'open-redirect';

interface ComputedSinkMatch {
  kind: SinkKind;
  severity: SecuritySeverity;
  cwe: string;
  description: string;
}

const DANGEROUS_PROPERTIES: Record<string, ComputedSinkMatch> = {
  innerHTML: {
    kind: 'xss', severity: 'high', cwe: 'CWE-79',
    description: 'DOM innerHTML assignment allows script injection.',
  },
  outerHTML: {
    kind: 'xss', severity: 'high', cwe: 'CWE-79',
    description: 'DOM outerHTML replacement allows script injection.',
  },
  srcdoc: {
    kind: 'xss', severity: 'high', cwe: 'CWE-79',
    description: 'iframe srcdoc allows HTML injection in a sandboxed frame.',
  },
  href: {
    kind: 'open-redirect', severity: 'medium', cwe: 'CWE-601',
    description: 'Dynamic href assignment can lead to open redirect or javascript: URI.',
  },
  src: {
    kind: 'ssrf', severity: 'medium', cwe: 'CWE-918',
    description: 'Dynamic src assignment may load attacker-controlled resources.',
  },
  action: {
    kind: 'open-redirect', severity: 'medium', cwe: 'CWE-601',
    description: 'Dynamic form action can redirect form submissions to attacker-controlled endpoints.',
  },
};

const DANGEROUS_FUNCTION_SINKS: Record<string, ComputedSinkMatch> = {
  eval: {
    kind: 'command-injection', severity: 'critical', cwe: 'CWE-95',
    description: 'eval() executes arbitrary code.',
  },
  exec: {
    kind: 'command-injection', severity: 'critical', cwe: 'CWE-78',
    description: 'exec() executes shell commands.',
  },
  execSync: {
    kind: 'command-injection', severity: 'critical', cwe: 'CWE-78',
    description: 'execSync() executes shell commands synchronously.',
  },
};

const TEMPLATE_DANGEROUS_CONTEXTS = new Set([
  'innerHTML', 'outerHTML', 'srcdoc', 'href',
  'query', '$queryRaw', '$executeRaw', 'exec',
]);

export function resolveComputedSinks(
  program: ts.Program,
  files: ts.SourceFile[],
): SecurityFinding[] {
  const checker = program.getTypeChecker();
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const sf of files) {
    visitNode(sf);

    function visitNode(node: ts.Node): void {
      // obj[computedKey] — resolve the key's type/value
      if (ts.isElementAccessExpression(node)) {
        const resolved = resolveComputedKey(node, sf, checker);
        if (resolved) {
          const sinkMatch = DANGEROUS_PROPERTIES[resolved];
          if (sinkMatch && isInDangerousPosition(node)) {
            counter++;
            findings.push(buildFinding(counter, node, sf, sinkMatch,
              `Computed property access resolves to "${resolved}", a known ${sinkMatch.kind} sink.`));
          }
        }
      }

      // Template literals used in dangerous contexts
      if (ts.isTaggedTemplateExpression(node) || ts.isTemplateExpression(node)) {
        const templateSink = resolveTemplateSink(node, sf, checker);
        if (templateSink) {
          counter++;
          findings.push(buildFinding(counter, node, sf, templateSink.match, templateSink.description));
        }
      }

      // Call expressions with computed callee: obj[key](...)
      if (ts.isCallExpression(node) && ts.isElementAccessExpression(node.expression)) {
        const resolvedCallee = resolveComputedKey(node.expression, sf, checker);
        if (resolvedCallee) {
          const funcSink = DANGEROUS_FUNCTION_SINKS[resolvedCallee];
          if (funcSink) {
            counter++;
            findings.push(buildFinding(counter, node, sf, funcSink,
              `Computed function call resolves to "${resolvedCallee}": ${funcSink.description}`));
          }
        }
      }

      ts.forEachChild(node, visitNode);
    }
  }

  return findings;
}

function resolveComputedKey(
  node: ts.ElementAccessExpression,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
): string | undefined {
  const keyExpr = node.argumentExpression;

  // Direct string literal: obj["innerHTML"]
  if (ts.isStringLiteral(keyExpr)) return keyExpr.text;

  // Const variable or type-narrowed identifier
  if (ts.isIdentifier(keyExpr)) {
    const type = checker.getTypeAtLocation(keyExpr);
    if (type.isStringLiteral()) return type.value;

    const symbol = checker.getSymbolAtLocation(keyExpr);
    if (symbol) {
      const decls = symbol.getDeclarations();
      if (decls && decls.length > 0) {
        const decl = decls[0];
        if (ts.isVariableDeclaration(decl) && decl.initializer && ts.isStringLiteral(decl.initializer)) {
          return decl.initializer.text;
        }
      }
    }
  }

  // Type-level resolution
  const keyType = checker.getTypeAtLocation(keyExpr);
  if (keyType.isStringLiteral()) return keyType.value;

  // Union type: check if ALL members are known dangerous props
  if (keyType.isUnion()) {
    for (const member of keyType.types) {
      if (member.isStringLiteral() && DANGEROUS_PROPERTIES[member.value]) {
        return member.value;
      }
    }
  }

  return undefined;
}

function resolveTemplateSink(
  node: ts.Node,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
): { match: ComputedSinkMatch; description: string } | undefined {
  const parent = node.parent;
  if (!parent) return undefined;

  // Check if template is used in assignment: el.innerHTML = `...${expr}...`
  if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const target = parent.left;
    if (ts.isPropertyAccessExpression(target)) {
      const propName = target.name.text;
      if (TEMPLATE_DANGEROUS_CONTEXTS.has(propName)) {
        const sinkMatch = DANGEROUS_PROPERTIES[propName];
        if (sinkMatch) {
          const hasInterpolation = ts.isTemplateExpression(node) && node.templateSpans.length > 0;
          if (hasInterpolation) {
            return {
              match: sinkMatch,
              description: `Template literal with interpolation assigned to "${propName}" — potential ${sinkMatch.kind}.`,
            };
          }
        }
      }
    }
  }

  // Check if template is passed as argument to a dangerous function
  if (ts.isCallExpression(parent)) {
    const calleeText = parent.expression.getText(sf);
    for (const [name, match] of Object.entries(DANGEROUS_FUNCTION_SINKS)) {
      if (calleeText.endsWith(name)) {
        const hasInterpolation = ts.isTemplateExpression(node) && node.templateSpans.length > 0;
        if (hasInterpolation) {
          return {
            match,
            description: `Template literal with interpolation passed to ${name}() — potential ${match.kind}.`,
          };
        }
      }
    }

    // SQL-specific: check for .query() / .$queryRaw() / .raw()
    if (
      ts.isPropertyAccessExpression(parent.expression) &&
      TEMPLATE_DANGEROUS_CONTEXTS.has(parent.expression.name.text)
    ) {
      const hasInterpolation = ts.isTemplateExpression(node) && node.templateSpans.length > 0;
      if (hasInterpolation) {
        return {
          match: {
            kind: 'sql-injection',
            severity: 'critical',
            cwe: 'CWE-89',
            description: 'SQL query with template literal interpolation.',
          },
          description:
            `Template literal with interpolation used in ${parent.expression.name.text}() — ` +
            `potential SQL injection.`,
        };
      }
    }
  }

  return undefined;
}

function isInDangerousPosition(node: ts.ElementAccessExpression): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // Assignment target: obj[key] = value
  if (ts.isBinaryExpression(parent)) {
    return (
      parent.left === node &&
      (parent.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
        parent.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)
    );
  }

  // Call expression: obj[key](args)
  if (ts.isCallExpression(parent) && parent.expression === node) {
    return true;
  }

  return false;
}

function buildFinding(
  id: number,
  node: ts.Node,
  sf: ts.SourceFile,
  sinkMatch: ComputedSinkMatch,
  description: string,
): SecurityFinding {
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return {
    id: `DEEP-SINK-${String(id).padStart(3, '0')}`,
    title: `Computed ${sinkMatch.kind} sink detected`,
    severity: sinkMatch.severity,
    file: sf.fileName,
    line: line + 1,
    column: character + 1,
    description,
    recommendation: recommendationFor(sinkMatch.kind),
    snippet: node.getText(sf).slice(0, 200),
    context: { cwe: sinkMatch.cwe },
  };
}

function recommendationFor(kind: SinkKind): string {
  switch (kind) {
    case 'xss':
      return 'Sanitize content with DOMPurify or use textContent instead. Consider Trusted Types.';
    case 'sql-injection':
      return 'Use parameterized queries or tagged template literals (e.g., Prisma.sql`...`).';
    case 'command-injection':
      return 'Avoid eval/exec with dynamic input. Use execFile with explicit arguments.';
    case 'path-traversal':
      return 'Validate and normalize paths with path.resolve against an allowed base directory.';
    case 'ssrf':
      return 'Validate URLs against an allowlist of known-safe hosts before fetching.';
    case 'open-redirect':
      return 'Validate redirect targets against an allowlist. Never redirect to user-controlled URLs.';
  }
}
