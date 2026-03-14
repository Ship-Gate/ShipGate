import ts from 'typescript';
import type { Analyzer, RaceFinding } from '../types.js';

const MUTABLE_COLLECTION_TYPES = new Set(['Map', 'Set', 'Array', 'Object']);

const COLLECTION_MUTATORS = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill',
  'set', 'delete', 'add', 'clear',
]);

const REQUEST_HANDLER_NAMES = new Set([
  'get', 'post', 'put', 'patch', 'delete', 'use', 'all', 'head', 'options',
]);

export class SharedStateAnalyzer implements Analyzer {
  name = 'shared-state';

  analyze(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const moduleLevelMutables = this.collectModuleLevelMutables(sourceFile);
    if (moduleLevelMutables.size === 0) return findings;

    this.walkAsyncContexts(sourceFile, sourceFile, (asyncNode, varName, accessNode, kind) => {
      if (!moduleLevelMutables.has(varName)) return;

      const decl = moduleLevelMutables.get(varName)!;
      const line = sourceFile.getLineAndCharacterOfPosition(accessNode.getStart()).line + 1;

      if (kind === 'write') {
        const hasReadAfterWrite = this.hasReadAfterWriteInScope(asyncNode, varName, accessNode);

        findings.push({
          type: 'shared-mutable-state',
          severity: hasReadAfterWrite ? 'critical' : 'high',
          file: filePath,
          line,
          description: hasReadAfterWrite
            ? `Module-level "${varName}" is written then read in async context — concurrent requests will see stale/corrupted values`
            : `Module-level "${varName}" is mutated inside an async context — concurrent requests share this state`,
          pattern: `let ${varName} = ...; handler(async () => { ${varName}${decl.kind === 'collection' ? '.push(...)' : '++'} })`,
          remediation: hasReadAfterWrite
            ? 'Move this variable inside the handler function, use a request-scoped store, or protect with a mutex'
            : 'Move this variable into the handler scope or use a request-local context (e.g., AsyncLocalStorage)',
        });
      } else if (kind === 'collection-mutate') {
        findings.push({
          type: 'shared-mutable-state',
          severity: 'high',
          file: filePath,
          line,
          description: `Module-level collection "${varName}" is mutated inside an async context — concurrent modifications will corrupt shared state`,
          pattern: `const ${varName} = new ${decl.typeHint ?? 'Map'}(); handler(async () => { ${varName}.set(...) })`,
          remediation: 'Use a request-scoped collection, or wrap mutations in a lock/mutex',
        });
      }
    });

    findings.push(...this.detectGlobalObjectMutations(sourceFile, filePath));

    return findings;
  }

  private collectModuleLevelMutables(
    sourceFile: ts.SourceFile,
  ): Map<string, { node: ts.Node; kind: 'scalar' | 'collection'; typeHint?: string }> {
    const result = new Map<string, { node: ts.Node; kind: 'scalar' | 'collection'; typeHint?: string }>();

    for (const stmt of sourceFile.statements) {
      if (!ts.isVariableStatement(stmt)) continue;

      const flags = stmt.declarationList.flags;
      const isLetOrVar =
        (flags & ts.NodeFlags.Let) !== 0 ||
        (flags & ts.NodeFlags.Const) === 0;
      const isConst = (flags & ts.NodeFlags.Const) !== 0;

      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;

        if (isLetOrVar) {
          result.set(name, { node: decl, kind: 'scalar' });
        }

        if (isConst && decl.initializer) {
          const collType = this.getCollectionType(decl.initializer);
          if (collType) {
            result.set(name, { node: decl, kind: 'collection', typeHint: collType });
          }
        }
      }
    }

    return result;
  }

  private getCollectionType(node: ts.Expression): string | undefined {
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (MUTABLE_COLLECTION_TYPES.has(name)) return name;
    }
    if (ts.isArrayLiteralExpression(node)) return 'Array';
    if (ts.isObjectLiteralExpression(node)) return 'Object';
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const objName = node.expression.expression;
      if (ts.isIdentifier(objName) && MUTABLE_COLLECTION_TYPES.has(objName.text)) {
        return objName.text;
      }
    }
    return undefined;
  }

  private walkAsyncContexts(
    sourceFile: ts.SourceFile,
    node: ts.Node,
    onAccess: (asyncNode: ts.Node, varName: string, accessNode: ts.Node, kind: 'write' | 'collection-mutate') => void,
  ): void {
    const visit = (n: ts.Node, asyncAncestor: ts.Node | null): void => {
      const newAsyncAncestor = this.getAsyncContext(n, sourceFile) ?? asyncAncestor;

      if (newAsyncAncestor) {
        this.checkNodeForMutation(n, (varName, accessNode, kind) => {
          onAccess(newAsyncAncestor, varName, accessNode, kind);
        });
      }

      ts.forEachChild(n, child => visit(child, newAsyncAncestor));
    };

    ts.forEachChild(node, child => visit(child, null));
  }

  private getAsyncContext(node: ts.Node, sourceFile: ts.SourceFile): ts.Node | null {
    if (
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
      this.hasAsyncModifier(node)
    ) {
      if (this.isInsideRequestHandler(node, sourceFile)) return node;
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;
      if (REQUEST_HANDLER_NAMES.has(methodName) && node.arguments.length > 0) {
        const lastArg = node.arguments[node.arguments.length - 1];
        if (ts.isFunctionExpression(lastArg) || ts.isArrowFunction(lastArg)) {
          return lastArg;
        }
      }

      if (methodName === 'on' || methodName === 'addEventListener') {
        const lastArg = node.arguments[node.arguments.length - 1];
        if (
          lastArg &&
          (ts.isFunctionExpression(lastArg) || ts.isArrowFunction(lastArg))
        ) {
          return lastArg;
        }
      }
    }

    return null;
  }

  private isInsideRequestHandler(node: ts.Node, _sourceFile: ts.SourceFile): boolean {
    let parent = node.parent;
    while (parent) {
      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression)) {
        if (REQUEST_HANDLER_NAMES.has(parent.expression.name.text)) return true;
      }
      if (ts.isExportAssignment(parent) || ts.isExportDeclaration(parent)) return true;
      parent = parent.parent;
    }
    return this.hasAsyncModifier(node);
  }

  private hasAsyncModifier(node: ts.Node): boolean {
    if (!('modifiers' in node)) return false;
    const modifiers = (node as ts.FunctionDeclaration).modifiers;
    return modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
  }

  private checkNodeForMutation(
    node: ts.Node,
    onMutation: (varName: string, accessNode: ts.Node, kind: 'write' | 'collection-mutate') => void,
  ): void {
    if (ts.isBinaryExpression(node) && this.isAssignmentOperator(node.operatorToken.kind)) {
      if (ts.isIdentifier(node.left)) {
        onMutation(node.left.text, node, 'write');
      }
    }

    if (
      (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) &&
      ts.isIdentifier(node.operand)
    ) {
      const op = node.operator;
      if (op === ts.SyntaxKind.PlusPlusToken || op === ts.SyntaxKind.MinusMinusToken) {
        onMutation(node.operand.text, node, 'write');
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      COLLECTION_MUTATORS.has(node.expression.name.text)
    ) {
      onMutation(node.expression.expression.text, node, 'collection-mutate');
    }
  }

  private isAssignmentOperator(kind: ts.SyntaxKind): boolean {
    return (
      kind === ts.SyntaxKind.EqualsToken ||
      kind === ts.SyntaxKind.PlusEqualsToken ||
      kind === ts.SyntaxKind.MinusEqualsToken ||
      kind === ts.SyntaxKind.AsteriskEqualsToken ||
      kind === ts.SyntaxKind.SlashEqualsToken ||
      kind === ts.SyntaxKind.BarEqualsToken ||
      kind === ts.SyntaxKind.AmpersandEqualsToken
    );
  }

  private hasReadAfterWriteInScope(asyncNode: ts.Node, varName: string, writeNode: ts.Node): boolean {
    let foundWrite = false;
    let foundReadAfter = false;

    const visit = (node: ts.Node): void => {
      if (foundReadAfter) return;

      if (node === writeNode) {
        foundWrite = true;
        return;
      }

      if (foundWrite && ts.isIdentifier(node) && node.text === varName) {
        const parent = node.parent;
        const isWriteTarget =
          (ts.isBinaryExpression(parent) && parent.left === node && this.isAssignmentOperator(parent.operatorToken.kind)) ||
          ((ts.isPostfixUnaryExpression(parent) || ts.isPrefixUnaryExpression(parent)) && parent.operand === node);

        if (!isWriteTarget) {
          foundReadAfter = true;
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(asyncNode, visit);
    return foundReadAfter;
  }

  private detectGlobalObjectMutations(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const visit = (node: ts.Node): void => {
      if (
        ts.isBinaryExpression(node) &&
        this.isAssignmentOperator(node.operatorToken.kind) &&
        ts.isPropertyAccessExpression(node.left)
      ) {
        const obj = node.left.expression;
        if (ts.isIdentifier(obj) && (obj.text === 'global' || obj.text === 'globalThis')) {
          const asyncParent = this.findAsyncAncestor(node);
          if (asyncParent) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            findings.push({
              type: 'shared-mutable-state',
              severity: 'critical',
              file: filePath,
              line,
              description: `Writing to ${obj.text}.${node.left.name.text} from async context — this is globally shared across all requests`,
              pattern: `${obj.text}.${node.left.name.text} = value`,
              remediation: 'Avoid mutating globalThis/global from async contexts; use request-scoped storage instead',
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return findings;
  }

  private findAsyncAncestor(node: ts.Node): ts.Node | null {
    let parent = node.parent;
    while (parent) {
      if (
        (ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isArrowFunction(parent)) &&
        this.hasAsyncModifier(parent)
      ) {
        return parent;
      }
      parent = parent.parent;
    }
    return null;
  }
}
