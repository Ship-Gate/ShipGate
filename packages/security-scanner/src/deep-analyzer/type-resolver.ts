import ts from 'typescript';
import type { SecurityFinding, SecuritySeverity } from '../verification/types.js';

const XSS_SINK_PROPERTIES = new Set(['innerHTML', 'outerHTML', 'srcdoc']);

const DANGEROUS_ASSIGNMENT_TARGETS = new Set([
  'innerHTML',
  'outerHTML',
  'srcdoc',
  'href',
  'src',
  'action',
  'formAction',
]);

export interface ResolvedSink {
  kind: 'xss' | 'injection' | 'redirect' | 'unknown';
  property: string;
  file: string;
  line: number;
  column: number;
  snippet: string;
}

export function resolveTypesAtSinks(
  program: ts.Program,
  files: ts.SourceFile[],
): SecurityFinding[] {
  const checker = program.getTypeChecker();
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const sf of files) {
    visitNode(sf);

    function visitNode(node: ts.Node): void {
      if (ts.isElementAccessExpression(node)) {
        handleElementAccess(node, sf);
      }

      if (ts.isPropertyAccessExpression(node)) {
        handlePropertyAccess(node, sf);
      }

      ts.forEachChild(node, visitNode);
    }

    function handleElementAccess(
      node: ts.ElementAccessExpression,
      sourceFile: ts.SourceFile,
    ): void {
      const keyType = checker.getTypeAtLocation(node.argumentExpression);
      const resolvedKey = resolveStringLiteralType(keyType, checker);

      if (resolvedKey && XSS_SINK_PROPERTIES.has(resolvedKey)) {
        if (isInAssignmentTarget(node)) {
          counter++;
          findings.push(buildXssFinding(
            counter,
            resolvedKey,
            node,
            sourceFile,
            `Bracket notation assignment to "${resolvedKey}" detected. ` +
            `The key resolves to a literal type that is a known XSS sink.`,
          ));
        }
      }
    }

    function handlePropertyAccess(
      node: ts.PropertyAccessExpression,
      sourceFile: ts.SourceFile,
    ): void {
      const propName = node.name.text;

      // Direct property access to known sinks
      if (DANGEROUS_ASSIGNMENT_TARGETS.has(propName) && isInAssignmentTarget(node)) {
        const objType = checker.getTypeAtLocation(node.expression);
        const isElement = typeInheritsFrom(objType, checker, [
          'HTMLElement', 'Element', 'HTMLIFrameElement',
        ]);

        if (isElement) {
          counter++;
          findings.push(buildXssFinding(
            counter,
            propName,
            node,
            sourceFile,
            `Direct assignment to "${propName}" on a DOM element.`,
          ));
        }
      }

      // Resolve through type aliases: if the property symbol resolves
      // to a declaration in a different file, follow the alias chain.
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        const aliased = checker.getAliasedSymbol(symbol);
        const aliasedName = aliased.getName();
        if (DANGEROUS_ASSIGNMENT_TARGETS.has(aliasedName) && isInAssignmentTarget(node)) {
          counter++;
          findings.push(buildXssFinding(
            counter,
            aliasedName,
            node,
            sourceFile,
            `Property "${propName}" resolves to aliased sink "${aliasedName}".`,
          ));
        }
      }
    }
  }

  return findings;
}

function resolveStringLiteralType(
  type: ts.Type,
  checker: ts.TypeChecker,
): string | undefined {
  if (type.isStringLiteral()) {
    return type.value;
  }

  if (type.isUnion()) {
    for (const member of type.types) {
      if (member.isStringLiteral() && XSS_SINK_PROPERTIES.has(member.value)) {
        return member.value;
      }
    }
  }

  const typeStr = checker.typeToString(type);
  if (XSS_SINK_PROPERTIES.has(typeStr.replace(/"/g, ''))) {
    return typeStr.replace(/"/g, '');
  }

  return undefined;
}

function typeInheritsFrom(
  type: ts.Type,
  checker: ts.TypeChecker,
  targets: string[],
): boolean {
  const typeStr = checker.typeToString(type);
  if (targets.some((t) => typeStr.includes(t))) return true;

  const baseTypes = type.getBaseTypes?.();
  if (baseTypes) {
    for (const base of baseTypes) {
      if (typeInheritsFrom(base, checker, targets)) return true;
    }
  }

  return false;
}

function isInAssignmentTarget(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;

  if (ts.isBinaryExpression(parent)) {
    return (
      parent.left === node &&
      (parent.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
        parent.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)
    );
  }

  if (ts.isCallExpression(parent) && parent.expression === node) {
    return false;
  }

  return false;
}

function buildXssFinding(
  id: number,
  property: string,
  node: ts.Node,
  sf: ts.SourceFile,
  description: string,
): SecurityFinding {
  const { line, character } = sf.getLineAndCharacterOfPosition(
    node.getStart(sf),
  );

  const severity: SecuritySeverity =
    property === 'innerHTML' || property === 'outerHTML' ? 'high' : 'medium';

  return {
    id: `DEEP-TYPE-${String(id).padStart(3, '0')}`,
    title: `XSS sink via "${property}" assignment`,
    severity,
    file: sf.fileName,
    line: line + 1,
    column: character + 1,
    description,
    recommendation:
      property === 'srcdoc'
        ? 'Sanitize content before assigning to iframe srcdoc. Use DOMPurify or a trusted types policy.'
        : `Avoid assigning unsanitized data to ${property}. Use textContent or a sanitization library like DOMPurify.`,
    snippet: node.getText(sf).slice(0, 200),
  };
}
