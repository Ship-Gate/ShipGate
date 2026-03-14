import ts from 'typescript';
import type { Analyzer, RaceFinding } from '../types.js';

const TIMER_FUNCTIONS = new Set(['setInterval', 'setTimeout']);

const COLLECTION_MUTATORS = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill',
  'set', 'delete', 'add', 'clear',
]);

export class AsyncPatternsAnalyzer implements Analyzer {
  name = 'async-patterns';

  analyze(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];
    findings.push(...this.detectPromiseAllSharedState(sourceFile, filePath));
    findings.push(...this.detectEventHandlerRaces(sourceFile, filePath));
    findings.push(...this.detectTimerSharedState(sourceFile, filePath));
    findings.push(...this.detectUnawaitedLoopAsync(sourceFile, filePath));
    return findings;
  }

  private detectPromiseAllSharedState(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const visit = (node: ts.Node): void => {
      if (!ts.isCallExpression(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      if (!this.isPromiseAllCall(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      if (node.arguments.length === 0) {
        ts.forEachChild(node, visit);
        return;
      }

      const arrayArg = node.arguments[0];
      if (!ts.isArrayLiteralExpression(arrayArg)) {
        ts.forEachChild(node, visit);
        return;
      }

      const mutatedVarsByElement = arrayArg.elements.map(el => this.collectMutatedVars(el));
      const allMutated = new Map<string, number[]>();

      for (let i = 0; i < mutatedVarsByElement.length; i++) {
        for (const varName of mutatedVarsByElement[i]) {
          if (!allMutated.has(varName)) allMutated.set(varName, []);
          allMutated.get(varName)!.push(i);
        }
      }

      for (const [varName, indices] of allMutated) {
        if (indices.length >= 2) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          findings.push({
            type: 'unguarded-async',
            severity: 'critical',
            file: filePath,
            line,
            description: `Promise.all races: "${varName}" is mutated by ${indices.length} concurrent promises (elements ${indices.join(', ')}) — mutations will interleave unpredictably`,
            pattern: `await Promise.all([fn1(), fn2()]) where both modify "${varName}"`,
            remediation: 'Have each promise return its result and merge after Promise.all resolves, or use sequential execution if order matters',
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return findings;
  }

  private detectEventHandlerRaces(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];
    const handlersByEvent = new Map<string, { node: ts.Node; mutatedVars: Set<string> }[]>();

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text;

        if (
          (methodName === 'on' || methodName === 'addEventListener' || methodName === 'addListener') &&
          node.arguments.length >= 2
        ) {
          const eventArg = node.arguments[0];
          const handlerArg = node.arguments[1];

          if (ts.isStringLiteral(eventArg)) {
            const eventName = eventArg.text;
            const mutatedVars = this.collectMutatedVars(handlerArg);

            if (!handlersByEvent.has(eventName)) handlersByEvent.set(eventName, []);
            handlersByEvent.get(eventName)!.push({ node: handlerArg, mutatedVars });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    for (const [eventName, handlers] of handlersByEvent) {
      if (handlers.length < 2) continue;

      const sharedMutated = new Map<string, number>();
      for (const handler of handlers) {
        for (const varName of handler.mutatedVars) {
          sharedMutated.set(varName, (sharedMutated.get(varName) ?? 0) + 1);
        }
      }

      for (const [varName, count] of sharedMutated) {
        if (count < 2) continue;

        const firstHandler = handlers.find(h => h.mutatedVars.has(varName))!;
        const line = sourceFile.getLineAndCharacterOfPosition(firstHandler.node.getStart()).line + 1;

        findings.push({
          type: 'unguarded-async',
          severity: 'high',
          file: filePath,
          line,
          description: `Event handler race: ${count} handlers for "${eventName}" event mutate shared variable "${varName}" — handler execution order is non-deterministic`,
          pattern: `emitter.on('${eventName}', () => { ${varName} = ... }); emitter.on('${eventName}', () => { ${varName} = ... })`,
          remediation: 'Consolidate mutations into a single handler, or use an event-sourcing pattern where each handler operates on immutable snapshots',
        });
      }
    }

    return findings;
  }

  private detectTimerSharedState(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];
    const moduleVars = this.collectModuleLevelVarNames(sourceFile);
    if (moduleVars.size === 0) return findings;

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const fnName = node.expression.text;

        if (TIMER_FUNCTIONS.has(fnName) && node.arguments.length >= 1) {
          const callback = node.arguments[0];
          const mutatedVars = this.collectMutatedVars(callback);

          for (const varName of mutatedVars) {
            if (!moduleVars.has(varName)) continue;

            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const isInterval = fnName === 'setInterval';

            findings.push({
              type: isInterval ? 'event-loop-starvation' : 'shared-mutable-state',
              severity: isInterval ? 'high' : 'medium',
              file: filePath,
              line,
              description: isInterval
                ? `setInterval mutates module-level "${varName}" — overlapping intervals can corrupt shared state if callback takes longer than interval period`
                : `setTimeout mutates module-level "${varName}" — timer callback races with concurrent async operations on the same variable`,
              pattern: `${fnName}(() => { ${varName} = ... }, delay)`,
              remediation: isInterval
                ? 'Guard the interval callback with a "running" flag to prevent overlap, or use setTimeout with recursive scheduling'
                : 'Move the variable into the callback scope, or use a mutex/lock to serialize access',
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return findings;
  }

  private detectUnawaitedLoopAsync(sourceFile: ts.SourceFile, filePath: string): RaceFinding[] {
    const findings: RaceFinding[] = [];

    const visit = (node: ts.Node): void => {
      if (
        (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
        !(ts.isForOfStatement(node) && node.awaitModifier)
      ) {
        const body = 'statement' in node ? node.statement : undefined;
        if (!body) {
          ts.forEachChild(node, visit);
          return;
        }

        const unawaitedCalls = this.findUnawaitedAsyncCalls(body);
        const mutatedVars = this.collectMutatedVars(body);

        if (unawaitedCalls.length > 0 && mutatedVars.size > 0) {
          const sharedWithOuter = new Set<string>();
          for (const varName of mutatedVars) {
            if (!this.isDeclaredInNode(node, varName)) sharedWithOuter.add(varName);
          }

          if (sharedWithOuter.size > 0) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const vars = [...sharedWithOuter].join(', ');
            findings.push({
              type: 'unguarded-async',
              severity: 'high',
              file: filePath,
              line,
              description: `Loop spawns unawaited async calls that mutate "${vars}" — all iterations race on shared state`,
              pattern: `for (...) { asyncFn(); ${vars} = ... }`,
              remediation: 'Use "for await...of", await each call inside the loop, or collect promises and use Promise.all with scoped state',
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return findings;
  }

  private isPromiseAllCall(node: ts.CallExpression): boolean {
    if (ts.isPropertyAccessExpression(node.expression)) {
      const obj = node.expression.expression;
      const method = node.expression.name.text;
      if (ts.isIdentifier(obj) && obj.text === 'Promise' && (method === 'all' || method === 'allSettled')) {
        return true;
      }
    }
    return false;
  }

  private collectMutatedVars(node: ts.Node): Set<string> {
    const vars = new Set<string>();

    const visit = (n: ts.Node): void => {
      if (ts.isBinaryExpression(n) && this.isAssignmentOp(n.operatorToken.kind)) {
        if (ts.isIdentifier(n.left)) vars.add(n.left.text);
        if (ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression)) {
          vars.add(n.left.expression.text);
        }
      }

      if (
        (ts.isPostfixUnaryExpression(n) || ts.isPrefixUnaryExpression(n)) &&
        ts.isIdentifier(n.operand) &&
        (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)
      ) {
        vars.add(n.operand.text);
      }

      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        ts.isIdentifier(n.expression.expression) &&
        COLLECTION_MUTATORS.has(n.expression.name.text)
      ) {
        vars.add(n.expression.expression.text);
      }

      ts.forEachChild(n, visit);
    };

    visit(node);
    return vars;
  }

  private collectModuleLevelVarNames(sourceFile: ts.SourceFile): Set<string> {
    const names = new Set<string>();
    for (const stmt of sourceFile.statements) {
      if (!ts.isVariableStatement(stmt)) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
      }
    }
    return names;
  }

  private findUnawaitedAsyncCalls(node: ts.Node): ts.CallExpression[] {
    const calls: ts.CallExpression[] = [];

    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        const parent = n.parent;
        if (!parent || !ts.isAwaitExpression(parent)) {
          const callee = n.expression;
          if (ts.isIdentifier(callee) && /^(async|fetch|save|update|create|delete|post|get|put)/.test(callee.text)) {
            calls.push(n);
          }
          if (ts.isPropertyAccessExpression(callee)) {
            const method = callee.name.text;
            if (/^(save|update|create|delete|fetch|post|get|put|send|emit)/.test(method)) {
              calls.push(n);
            }
          }
        }
      }
      ts.forEachChild(n, visit);
    };

    visit(node);
    return calls;
  }

  private isDeclaredInNode(node: ts.Node, varName: string): boolean {
    let found = false;
    const visit = (n: ts.Node): void => {
      if (found) return;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === varName) {
        found = true;
        return;
      }
      if (ts.isParameter(n) && ts.isIdentifier(n.name) && n.name.text === varName) {
        found = true;
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  }

  private isAssignmentOp(kind: ts.SyntaxKind): boolean {
    return (
      kind === ts.SyntaxKind.EqualsToken ||
      kind === ts.SyntaxKind.PlusEqualsToken ||
      kind === ts.SyntaxKind.MinusEqualsToken ||
      kind === ts.SyntaxKind.AsteriskEqualsToken ||
      kind === ts.SyntaxKind.SlashEqualsToken
    );
  }
}
