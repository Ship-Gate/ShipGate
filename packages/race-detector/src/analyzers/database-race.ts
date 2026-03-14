import ts from 'typescript';
import type { Analyzer, RaceFinding } from '../types.js';

const READ_METHODS = new Set([
  'findOne', 'findFirst', 'findUnique', 'findById', 'findByPk',
  'find', 'get', 'select', 'first', 'where', 'findOneBy',
]);

const WRITE_METHODS = new Set([
  'save', 'update', 'updateOne', 'updateMany', 'create', 'insert',
  'delete', 'deleteOne', 'remove', 'destroy', 'increment', 'decrement',
]);

const COUNT_METHODS = new Set(['count', 'countDocuments', 'aggregate']);

const TRANSACTION_WRAPPERS = new Set([
  'transaction', '$transaction', 'startSession', 'startTransaction',
  'sequelize.transaction', 'knex.transaction', 'withTransaction',
  'getManager', 'createQueryRunner',
]);

const ORM_IDENTIFIERS = new Set([
  'prisma', 'sequelize', 'typeorm', 'mongoose', 'knex',
  'Model', 'Repository', 'db', 'connection', 'em',
]);

export class DatabaseRaceAnalyzer implements Analyzer {
  name = 'database-race';

  analyze(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];
    findings.push(...this.detectReadModifySave(sourceFile, filePath));
    findings.push(...this.detectCountThenCreate(sourceFile, filePath));
    findings.push(...this.detectMissingOptimisticLock(sourceFile, filePath));
    return findings;
  }

  private detectReadModifySave(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const visitBlock = (node: ts.Node): void => {
      if (!ts.isBlock(node) && !ts.isSourceFile(node)) {
        ts.forEachChild(node, visitBlock);
        return;
      }

      const stmts = ts.isBlock(node) ? Array.from(node.statements) : Array.from((node as ts.SourceFile).statements);
      const readVars = new Map<string, { line: number; methodName: string; stmtIndex: number }>();

      for (let i = 0; i < stmts.length; i++) {
        const stmt = stmts[i];

        const readInfo = this.extractDbRead(stmt);
        if (readInfo) {
          readVars.set(readInfo.varName, { line: readInfo.line, methodName: readInfo.methodName, stmtIndex: i });
        }

        const writeInfo = this.extractDbWrite(stmt);
        if (writeInfo && readVars.has(writeInfo.objectName)) {
          const read = readVars.get(writeInfo.objectName)!;
          if (!this.isInsideTransaction(stmt)) {
            const hasMutationBetween = this.hasMutationBetween(stmts, read.stmtIndex, i, writeInfo.objectName);
            const line = sourceFile.getLineAndCharacterOfPosition(stmts[read.stmtIndex].getStart()).line + 1;

            findings.push({
              type: 'database-race',
              severity: hasMutationBetween ? 'critical' : 'high',
              file: filePath,
              line,
              description: `Read-modify-save without transaction: ${read.methodName}() → modify → ${writeInfo.methodName}() — concurrent requests can overwrite each other's changes`,
              pattern: `const ${writeInfo.objectName} = await db.${read.methodName}(id); ${writeInfo.objectName}.field = newValue; await ${writeInfo.objectName}.${writeInfo.methodName}();`,
              remediation: 'Wrap in a database transaction: await db.transaction(async (tx) => { ... }), or use atomic update: await db.update({ where: { id }, data: { field: newValue } })',
            });
          }
        }
      }

      ts.forEachChild(node, visitBlock);
    };

    visitBlock(sourceFile);
    return findings;
  }

  private detectCountThenCreate(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const visitBlock = (node: ts.Node): void => {
      if (!ts.isBlock(node) && !ts.isSourceFile(node)) {
        ts.forEachChild(node, visitBlock);
        return;
      }

      const stmts = ts.isBlock(node) ? Array.from(node.statements) : Array.from((node as ts.SourceFile).statements);
      const countVars = new Map<string, { line: number; stmtIndex: number }>();

      for (let i = 0; i < stmts.length; i++) {
        const stmt = stmts[i];
        const countInfo = this.extractCountCall(stmt);
        if (countInfo) {
          countVars.set(countInfo.varName, { line: countInfo.line, stmtIndex: i });
        }

        if (countVars.size > 0) {
          const createCall = this.extractCreateCall(stmt);
          if (createCall) {
            for (const [countVar, info] of countVars) {
              if (this.expressionReferencesVar(createCall.args, countVar)) {
                if (!this.isInsideTransaction(stmt)) {
                  const line = sourceFile.getLineAndCharacterOfPosition(stmts[info.stmtIndex].getStart()).line + 1;
                  findings.push({
                    type: 'database-race',
                    severity: 'critical',
                    file: filePath,
                    line,
                    description: `Count-then-create race: count() result used in create() — concurrent requests will produce duplicate values`,
                    pattern: `const ${countVar} = await Model.count(); await Model.create({ id: ${countVar} + 1 })`,
                    remediation: 'Use database auto-increment, UUIDs, or a sequence generator instead of count-based IDs',
                  });
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, visitBlock);
    };

    visitBlock(sourceFile);
    return findings;
  }

  private detectMissingOptimisticLock(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const visitBlock = (node: ts.Node): void => {
      if (!ts.isBlock(node) && !ts.isSourceFile(node)) {
        ts.forEachChild(node, visitBlock);
        return;
      }

      const stmts = ts.isBlock(node) ? Array.from(node.statements) : Array.from((node as ts.SourceFile).statements);

      for (let readIdx = 0; readIdx < stmts.length; readIdx++) {
        const readInfo = this.extractDbRead(stmts[readIdx]);
        if (!readInfo) continue;

        for (let writeIdx = readIdx + 1; writeIdx < stmts.length; writeIdx++) {
          const writeInfo = this.extractDbWrite(stmts[writeIdx]);
          if (!writeInfo || writeInfo.objectName !== readInfo.varName) continue;

          if (this.isInsideTransaction(stmts[readIdx])) break;

          const hasVersionCheck = this.hasVersionCheckBetween(stmts, readIdx, writeIdx, readInfo.varName);
          if (!hasVersionCheck) {
            const line = sourceFile.getLineAndCharacterOfPosition(stmts[readIdx].getStart()).line + 1;
            findings.push({
              type: 'database-race',
              severity: 'medium',
              file: filePath,
              line,
              description: `Missing optimistic locking: ${readInfo.methodName}() → modify → ${writeInfo.methodName}() without version/timestamp check — silent data loss on concurrent updates`,
              pattern: `const ${readInfo.varName} = await db.${readInfo.methodName}(id); ${readInfo.varName}.field = x; await ${readInfo.varName}.${writeInfo.methodName}()`,
              remediation: 'Add optimistic locking: include a "version" or "updatedAt" field in the WHERE clause of the update, and retry on conflict',
            });
          }
          break;
        }
      }

      ts.forEachChild(node, visitBlock);
    };

    visitBlock(sourceFile);
    return findings;
  }

  private extractDbRead(stmt: ts.Statement): { varName: string; methodName: string; line: number } | null {
    if (!ts.isVariableStatement(stmt)) return null;

    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;

      const call = this.unwrapAwait(decl.initializer);
      if (!call) continue;

      const methodName = this.getCallMethodName(call);
      if (!methodName || !READ_METHODS.has(methodName)) continue;

      if (this.isOrmCall(call)) {
        return { varName: decl.name.text, methodName, line: 0 };
      }
    }
    return null;
  }

  private extractDbWrite(stmt: ts.Statement): { objectName: string; methodName: string } | null {
    const call = this.extractAwaitedCall(stmt);
    if (!call) return null;

    const methodName = this.getCallMethodName(call);
    if (!methodName || !WRITE_METHODS.has(methodName)) return null;

    if (ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression)) {
      return { objectName: call.expression.expression.text, methodName };
    }

    if (
      ts.isPropertyAccessExpression(call.expression) &&
      ts.isPropertyAccessExpression(call.expression.expression)
    ) {
      const outer = call.expression.expression;
      if (ts.isIdentifier(outer.expression)) {
        return { objectName: outer.expression.text, methodName };
      }
    }

    return null;
  }

  private extractCountCall(stmt: ts.Statement): { varName: string; line: number } | null {
    if (!ts.isVariableStatement(stmt)) return null;

    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;

      const call = this.unwrapAwait(decl.initializer);
      if (!call) continue;

      const methodName = this.getCallMethodName(call);
      if (methodName && COUNT_METHODS.has(methodName)) {
        return { varName: decl.name.text, line: 0 };
      }
    }
    return null;
  }

  private extractCreateCall(stmt: ts.Statement): { args: ts.NodeArray<ts.Expression> } | null {
    const call = this.extractAwaitedCall(stmt);
    if (!call) return null;

    const methodName = this.getCallMethodName(call);
    if (methodName && (methodName === 'create' || methodName === 'insert')) {
      return { args: call.arguments };
    }
    return null;
  }

  private extractAwaitedCall(stmt: ts.Statement): ts.CallExpression | null {
    if (ts.isExpressionStatement(stmt)) {
      const expr = stmt.expression;
      if (ts.isAwaitExpression(expr) && ts.isCallExpression(expr.expression)) {
        return expr.expression;
      }
      if (ts.isCallExpression(expr)) return expr;
    }
    return null;
  }

  private unwrapAwait(node: ts.Expression): ts.CallExpression | null {
    if (ts.isAwaitExpression(node) && ts.isCallExpression(node.expression)) return node.expression;
    if (ts.isCallExpression(node)) return node;
    return null;
  }

  private getCallMethodName(call: ts.CallExpression): string | null {
    if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
    if (ts.isIdentifier(call.expression)) return call.expression.text;
    return null;
  }

  private isOrmCall(call: ts.CallExpression): boolean {
    if (ts.isPropertyAccessExpression(call.expression)) {
      const obj = call.expression.expression;
      if (ts.isIdentifier(obj) && ORM_IDENTIFIERS.has(obj.text)) return true;

      if (ts.isPropertyAccessExpression(obj) && ts.isIdentifier(obj.expression)) {
        if (ORM_IDENTIFIERS.has(obj.expression.text)) return true;
      }
    }
    return true;
  }

  private isInsideTransaction(node: ts.Node): boolean {
    let parent = node.parent;
    while (parent) {
      if (ts.isCallExpression(parent)) {
        const name = this.getFullCallName(parent);
        if (name && TRANSACTION_WRAPPERS.has(name)) return true;

        const methodName = this.getCallMethodName(parent);
        if (methodName && TRANSACTION_WRAPPERS.has(methodName)) return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  private getFullCallName(call: ts.CallExpression): string | null {
    if (ts.isPropertyAccessExpression(call.expression)) {
      const obj = call.expression.expression;
      const method = call.expression.name.text;
      if (ts.isIdentifier(obj)) return `${obj.text}.${method}`;
    }
    return null;
  }

  private hasMutationBetween(stmts: ts.Statement[], start: number, end: number, varName: string): boolean {
    for (let i = start + 1; i < end; i++) {
      if (this.statementMutatesVar(stmts[i], varName)) return true;
    }
    return false;
  }

  private statementMutatesVar(stmt: ts.Statement, varName: string): boolean {
    let found = false;
    const visit = (n: ts.Node): void => {
      if (found) return;
      if (ts.isBinaryExpression(n) && ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression)) {
        if (n.left.expression.text === varName) { found = true; return; }
      }
      ts.forEachChild(n, visit);
    };
    visit(stmt);
    return found;
  }

  private hasVersionCheckBetween(stmts: ts.Statement[], start: number, end: number, varName: string): boolean {
    for (let i = start + 1; i < end; i++) {
      const text = stmts[i].getText();
      if (
        text.includes('version') ||
        text.includes('updatedAt') ||
        text.includes('updated_at') ||
        text.includes('etag') ||
        text.includes('revision')
      ) {
        if (this.expressionReferencesVar2(stmts[i], varName)) return true;
      }
    }
    return false;
  }

  private expressionReferencesVar(nodes: ts.NodeArray<ts.Expression>, varName: string): boolean {
    for (const node of nodes) {
      if (this.nodeReferencesVar(node, varName)) return true;
    }
    return false;
  }

  private expressionReferencesVar2(node: ts.Node, varName: string): boolean {
    return this.nodeReferencesVar(node, varName);
  }

  private nodeReferencesVar(node: ts.Node, varName: string): boolean {
    if (ts.isIdentifier(node) && node.text === varName) return true;
    let found = false;
    ts.forEachChild(node, child => {
      if (!found) found = this.nodeReferencesVar(child, varName);
    });
    return found;
  }
}
