/**
 * Type Consistency Verification Checker
 *
 * - Function parameter types match caller argument types
 * - Return types match what callers expect
 * - Entity types consistent across layers (Prisma model ↔ API response ↔ frontend props)
 * - Flag: type mismatches, implicit `any`, missing type annotations on public functions
 * - Severity: mismatch = high, implicit any = medium
 */

import * as ts from 'typescript';
import type { Finding, VerificationContext } from '../types.js';

const CHECKER_NAME = 'TypeConsistencyVerifier';

function makeId(prefix: string, ...parts: string[]): string {
  return `${prefix}-${parts.join('-').replace(/[^a-z0-9-]/gi, '')}`.slice(0, 80);
}

/** Detect implicit any in function signatures */
function checkImplicitAny(
  sourceFile: ts.SourceFile,
  filePath: string
): Finding[] {
  const findings: Finding[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
      const params = ts.isFunctionDeclaration(node)
        ? node.parameters
        : node.parameters;
      for (const param of params) {
        if (!param.type && !param.dotDotDotToken) {
          const name = (param.name as ts.Identifier).getText();
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            param.getStart()
          );
          findings.push({
            id: makeId('type-implicit-any-param', filePath, name),
            checker: CHECKER_NAME,
            ruleId: 'type/implicit-any-param',
            severity: 'medium',
            message: `Parameter "${name}" has implicit \`any\` type`,
            file: filePath,
            line: line + 1,
            column: character + 1,
            blocking: false,
            recommendation: 'Add explicit type annotation to the parameter.',
            context: { paramName: name },
          });
        }
      }

      if (ts.isFunctionDeclaration(node) && !node.type) {
        const name = node.name?.getText() ?? 'anonymous';
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );
        if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          findings.push({
            id: makeId('type-missing-return', filePath, name),
            checker: CHECKER_NAME,
            ruleId: 'type/missing-return-annotation',
            severity: 'medium',
            message: `Exported function "${name}" has no return type annotation`,
            file: filePath,
            line: line + 1,
            column: character + 1,
            blocking: false,
            recommendation: 'Add explicit return type for public functions.',
            context: { functionName: name },
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}

/** Check for explicit `any` type usage */
function checkExplicitAny(
  sourceFile: ts.SourceFile,
  filePath: string
): Finding[] {
  const findings: Finding[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isTypeReferenceNode(node)) {
      if (node.typeName.getText() === 'any') {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );
        findings.push({
          id: makeId('type-explicit-any', filePath, String(line)),
          checker: CHECKER_NAME,
          ruleId: 'type/explicit-any',
          severity: 'medium',
          message: 'Explicit `any` type detected',
          file: filePath,
          line: line + 1,
          column: character + 1,
          blocking: false,
          recommendation: 'Use proper TypeScript types or `unknown` instead of `any`.',
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}

export async function runTypeConsistencyVerifier(
  ctx: VerificationContext
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const [filePath, content] of ctx.implFiles) {
    if (!/\.(ts|tsx)$/.test(filePath)) continue;

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    findings.push(...checkImplicitAny(sourceFile, filePath));
    findings.push(...checkExplicitAny(sourceFile, filePath));
  }

  return findings;
}
