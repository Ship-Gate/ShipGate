import ts from 'typescript';
import type { Analyzer, RaceFinding } from '../types.js';

interface CheckUsePattern {
  checkFunctions: string[];
  useFunctions: string[];
  label: string;
  severity: 'critical' | 'high' | 'medium';
}

const FS_TOCTOU_PATTERNS: CheckUsePattern[] = [
  {
    checkFunctions: ['existsSync', 'exists', 'accessSync', 'access', 'statSync', 'stat'],
    useFunctions: ['readFileSync', 'readFile', 'writeFileSync', 'writeFile', 'unlinkSync', 'unlink', 'renameSync', 'rename', 'mkdirSync', 'mkdir'],
    label: 'filesystem',
    severity: 'high',
  },
];

const DB_CHECK_METHODS = new Set([
  'findOne', 'findFirst', 'findUnique', 'findById', 'find', 'count', 'exists',
  'get', 'select', 'where', 'first',
]);

const DB_WRITE_METHODS = new Set([
  'update', 'updateOne', 'updateMany', 'save', 'create', 'insert', 'delete',
  'deleteOne', 'deleteMany', 'remove', 'destroy', 'upsert', 'increment',
]);

export class ToctouAnalyzer implements Analyzer {
  name = 'toctou';

  analyze(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];
    findings.push(...this.detectFsToctou(sourceFile, filePath));
    findings.push(...this.detectDbToctou(sourceFile, filePath));
    findings.push(...this.detectReadConditionalWrite(sourceFile, filePath));
    return findings;
  }

  private detectFsToctou(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isIfStatement(node)) {
        const checkCall = this.findCallInExpression(node.expression);
        if (!checkCall) {
          ts.forEachChild(node, visit);
          return;
        }

        const checkName = this.getCallName(checkCall);
        if (!checkName) {
          ts.forEachChild(node, visit);
          return;
        }

        for (const pattern of FS_TOCTOU_PATTERNS) {
          if (!pattern.checkFunctions.includes(checkName)) continue;

          const useCalls = this.findCallsInBlock(node.thenStatement);
          for (const useCall of useCalls) {
            const useName = this.getCallName(useCall);
            if (useName && pattern.useFunctions.includes(useName)) {
              const checkArgs = this.extractPathArg(checkCall);
              const useArgs = this.extractPathArg(useCall);
              const sameTarget = checkArgs && useArgs && checkArgs === useArgs;

              if (sameTarget || !checkArgs || !useArgs) {
                const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                findings.push({
                  type: 'toctou',
                  severity: pattern.severity,
                  file: filePath,
                  line,
                  description: `TOCTOU: ${checkName}() check followed by ${useName}() — the ${pattern.label} state may change between check and use`,
                  pattern: `if (${checkName}(path)) { ${useName}(path) }`,
                  remediation: 'Use try/catch around the operation instead of checking first, or use atomic operations (e.g., fs.open with exclusive flag)',
                });
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return findings;
  }

  private detectDbToctou(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const visit = (node: ts.Node): void => {
      if (!ts.isIfStatement(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      const condition = node.expression;
      const awaitedCheck = this.findAwaitedCallIn(condition);
      if (!awaitedCheck) {
        ts.forEachChild(node, visit);
        return;
      }

      const checkName = this.getCallName(awaitedCheck);
      if (!checkName || !DB_CHECK_METHODS.has(checkName)) {
        ts.forEachChild(node, visit);
        return;
      }

      const bodyCalls = this.findAwaitedCallsInBlock(node.thenStatement);
      for (const bodyCall of bodyCalls) {
        const bodyName = this.getCallName(bodyCall);
        if (bodyName && DB_WRITE_METHODS.has(bodyName)) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          findings.push({
            type: 'toctou',
            severity: 'critical',
            file: filePath,
            line,
            description: `TOCTOU: await ${checkName}() check then await ${bodyName}() — the record could be modified or deleted between check and use by a concurrent request`,
            pattern: `if (await db.${checkName}(id)) { await db.${bodyName}(id, data) }`,
            remediation: 'Wrap the check-and-write in a database transaction, or use upsert/conditional update with a WHERE clause',
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return findings;
  }

  private detectReadConditionalWrite(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const visit = (node: ts.Node): void => {
      if (!ts.isBlock(node) && !ts.isSourceFile(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      const stmts = ts.isBlock(node) ? Array.from(node.statements) : Array.from((node as ts.SourceFile).statements);

      for (let i = 0; i < stmts.length - 1; i++) {
        const stmt = stmts[i];
        if (!ts.isVariableStatement(stmt)) continue;

        for (const decl of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
          const varName = decl.name.text;

          const propAccess = this.extractPropertyAccess(decl.initializer);
          if (!propAccess) continue;

          const nextStmt = stmts[i + 1];
          if (!ts.isIfStatement(nextStmt)) continue;

          if (!this.expressionReferences(nextStmt.expression, varName)) continue;

          if (this.blockContainsAssignmentToPropertyOf(nextStmt.thenStatement, propAccess.objectName, propAccess.propertyName)) {
            const line = sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1;
            findings.push({
              type: 'toctou',
              severity: 'high',
              file: filePath,
              line,
              description: `TOCTOU: "${varName}" read from ${propAccess.objectName}.${propAccess.propertyName}, then conditionally written — value may change between read and write`,
              pattern: `const ${varName} = ${propAccess.objectName}.${propAccess.propertyName}; if (${varName} >= amount) { ${propAccess.objectName}.${propAccess.propertyName} -= amount; }`,
              remediation: 'Use atomic compare-and-swap, optimistic locking with version field, or wrap in a transaction',
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return findings;
  }

  private findCallInExpression(node: ts.Expression): ts.CallExpression | null {
    if (ts.isCallExpression(node)) return node;
    if (ts.isPrefixUnaryExpression(node)) return this.findCallInExpression(node.operand);
    if (ts.isAwaitExpression(node)) return this.findCallInExpression(node.expression);
    if (ts.isParenthesizedExpression(node)) return this.findCallInExpression(node.expression);
    return null;
  }

  private findAwaitedCallIn(node: ts.Node): ts.CallExpression | null {
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) {
      return node.expression;
    }
    let found: ts.CallExpression | null = null;
    ts.forEachChild(node, child => {
      if (!found) found = this.findAwaitedCallIn(child);
    });
    return found;
  }

  private findCallsInBlock(node: ts.Node): ts.CallExpression[] {
    const calls: ts.CallExpression[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) calls.push(n);
      ts.forEachChild(n, visit);
    };
    visit(node);
    return calls;
  }

  private findAwaitedCallsInBlock(node: ts.Node): ts.CallExpression[] {
    const calls: ts.CallExpression[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isAwaitExpression(n) && ts.isCallExpression(n.expression)) {
        calls.push(n.expression);
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    return calls;
  }

  private getCallName(call: ts.CallExpression): string | null {
    if (ts.isIdentifier(call.expression)) return call.expression.text;
    if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
    return null;
  }

  private extractPathArg(call: ts.CallExpression): string | null {
    if (call.arguments.length === 0) return null;
    const first = call.arguments[0];
    if (ts.isIdentifier(first)) return first.text;
    if (ts.isStringLiteral(first)) return first.text;
    return null;
  }

  private extractPropertyAccess(node: ts.Expression): { objectName: string; propertyName: string } | null {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      return { objectName: node.expression.text, propertyName: node.name.text };
    }
    return null;
  }

  private expressionReferences(expr: ts.Expression, name: string): boolean {
    if (ts.isIdentifier(expr) && expr.text === name) return true;
    let found = false;
    ts.forEachChild(expr, child => {
      if (!found && ts.isIdentifier(child) && child.text === name) found = true;
      if (!found) {
        ts.forEachChild(child, grandChild => {
          if (ts.isIdentifier(grandChild) && grandChild.text === name) found = true;
        });
      }
    });
    return found;
  }

  private blockContainsAssignmentToPropertyOf(
    node: ts.Node,
    objectName: string,
    propertyName: string,
  ): boolean {
    let found = false;
    const visit = (n: ts.Node): void => {
      if (found) return;
      if (
        ts.isBinaryExpression(n) &&
        ts.isPropertyAccessExpression(n.left) &&
        ts.isIdentifier(n.left.expression) &&
        n.left.expression.text === objectName &&
        n.left.name.text === propertyName
      ) {
        found = true;
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  }
}
