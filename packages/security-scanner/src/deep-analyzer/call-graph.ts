import ts from 'typescript';
import type { SecurityFinding } from '../verification/types.js';

export interface CallGraphNode {
  name: string;
  file: string;
  calls: Set<string>;
  calledBy: Set<string>;
  paramFlowsToReturn: Set<number>;
  paramNames: string[];
}

export interface CallGraph {
  nodes: Map<string, CallGraphNode>;
}

export function buildCallGraph(
  program: ts.Program,
  files: ts.SourceFile[],
): CallGraph {
  const checker = program.getTypeChecker();
  const graph: CallGraph = { nodes: new Map() };

  // Pass 1: collect all function declarations
  for (const sf of files) {
    collectDeclarations(sf, sf, graph);
  }

  // Pass 2: trace call edges and parameter flow
  for (const sf of files) {
    traceCallEdges(sf, sf, graph, checker);
  }

  // Pass 3: propagate transitive taint through the call graph
  propagateTransitiveTaint(graph);

  return graph;
}

export function findTaintedPaths(
  graph: CallGraph,
  program: ts.Program,
  files: ts.SourceFile[],
): SecurityFinding[] {
  const checker = program.getTypeChecker();
  const findings: SecurityFinding[] = [];
  let counter = 0;

  for (const sf of files) {
    findTaintedCalls(sf, sf);

    function findTaintedCalls(node: ts.Node, sourceFile: ts.SourceFile): void {
      if (ts.isCallExpression(node)) {
        const calleeName = resolveCalleeName(node.expression, checker);
        if (calleeName) {
          const graphNode = graph.nodes.get(calleeName);
          if (graphNode && graphNode.paramFlowsToReturn.size > 0) {
            for (const paramIdx of graphNode.paramFlowsToReturn) {
              const arg = node.arguments[paramIdx];
              if (arg && containsUserInput(arg, sourceFile)) {
                counter++;
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(
                  node.getStart(sourceFile),
                );
                findings.push({
                  id: `DEEP-CG-${String(counter).padStart(3, '0')}`,
                  title: `Tainted data flows through ${calleeName}`,
                  severity: 'medium',
                  file: sourceFile.fileName,
                  line: line + 1,
                  column: character + 1,
                  description:
                    `User-controlled input is passed to parameter ${paramIdx} of "${calleeName}", ` +
                    `which propagates to the return value. If the return value reaches a sink, ` +
                    `this constitutes a taint flow.`,
                  recommendation:
                    'Validate or sanitize the input before passing it through this function chain.',
                  snippet: node.getText(sourceFile).slice(0, 200),
                });
              }
            }
          }
        }
      }
      ts.forEachChild(node, (child) => findTaintedCalls(child, sourceFile));
    }
  }

  return findings;
}

function collectDeclarations(
  node: ts.Node,
  sf: ts.SourceFile,
  graph: CallGraph,
): void {
  const funcInfo = extractFunctionInfo(node, sf);
  if (funcInfo) {
    const qualifiedName = `${sf.fileName}::${funcInfo.name}`;
    graph.nodes.set(funcInfo.name, {
      name: funcInfo.name,
      file: sf.fileName,
      calls: new Set(),
      calledBy: new Set(),
      paramFlowsToReturn: funcInfo.paramFlowsToReturn,
      paramNames: funcInfo.paramNames,
    });
    graph.nodes.set(qualifiedName, graph.nodes.get(funcInfo.name)!);
  }

  ts.forEachChild(node, (child) => collectDeclarations(child, sf, graph));
}

function extractFunctionInfo(
  node: ts.Node,
  sf: ts.SourceFile,
): { name: string; paramNames: string[]; paramFlowsToReturn: Set<number> } | undefined {
  let name: string | undefined;
  let funcNode:
    | ts.FunctionDeclaration
    | ts.ArrowFunction
    | ts.FunctionExpression
    | ts.MethodDeclaration
    | undefined;

  if (ts.isFunctionDeclaration(node) && node.name) {
    name = node.name.text;
    funcNode = node;
  } else if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    name = node.name.text;
    funcNode = node.initializer;
  } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    name = node.name.text;
    funcNode = node;
  }

  if (!name || !funcNode) return undefined;

  const paramNames = (funcNode.parameters ?? []).map((p) =>
    ts.isIdentifier(p.name) ? p.name.text : '',
  );
  const paramFlowsToReturn = new Set<number>();

  const scanReturns = (n: ts.Node) => {
    if (ts.isReturnStatement(n) && n.expression) {
      scanExprForParams(n.expression, paramNames, paramFlowsToReturn, sf);
    }
    ts.forEachChild(n, scanReturns);
  };

  if (funcNode.body) {
    if (ts.isBlock(funcNode.body)) {
      ts.forEachChild(funcNode.body, scanReturns);
    } else {
      scanExprForParams(funcNode.body, paramNames, paramFlowsToReturn, sf);
    }
  }

  return { name, paramNames, paramFlowsToReturn };
}

function scanExprForParams(
  expr: ts.Node,
  paramNames: string[],
  result: Set<number>,
  sf: ts.SourceFile,
): void {
  if (ts.isIdentifier(expr)) {
    const idx = paramNames.indexOf(expr.text);
    if (idx >= 0) result.add(idx);
    return;
  }

  if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) {
    scanExprForParams(expr.expression, paramNames, result, sf);
    return;
  }

  if (ts.isTemplateExpression(expr)) {
    for (const span of expr.templateSpans) {
      scanExprForParams(span.expression, paramNames, result, sf);
    }
    return;
  }

  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    scanExprForParams(expr.left, paramNames, result, sf);
    scanExprForParams(expr.right, paramNames, result, sf);
    return;
  }

  if (ts.isCallExpression(expr)) {
    for (const arg of expr.arguments) {
      scanExprForParams(arg, paramNames, result, sf);
    }
  }

  ts.forEachChild(expr, (child) => scanExprForParams(child, paramNames, result, sf));
}

function traceCallEdges(
  node: ts.Node,
  sf: ts.SourceFile,
  graph: CallGraph,
  checker: ts.TypeChecker,
): void {
  const enclosingFunc = findEnclosingFunction(node);
  const callerName = enclosingFunc
    ? getFunctionName(enclosingFunc, sf)
    : undefined;

  if (ts.isCallExpression(node)) {
    const calleeName = resolveCalleeName(node.expression, checker);
    if (calleeName && callerName) {
      const callerNode = graph.nodes.get(callerName);
      const calleeNode = graph.nodes.get(calleeName);
      if (callerNode) callerNode.calls.add(calleeName);
      if (calleeNode) calleeNode.calledBy.add(callerName);
    }
  }

  ts.forEachChild(node, (child) => traceCallEdges(child, sf, graph, checker));
}

function propagateTransitiveTaint(graph: CallGraph): void {
  let changed = true;
  let iterations = 0;
  const maxIterations = graph.nodes.size * 2;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const [, node] of graph.nodes) {
      for (const calleeName of node.calls) {
        const calleeNode = graph.nodes.get(calleeName);
        if (!calleeNode) continue;

        if (calleeNode.paramFlowsToReturn.size > 0) {
          const sizeBefore = node.paramFlowsToReturn.size;
          for (const idx of calleeNode.paramFlowsToReturn) {
            if (idx < node.paramNames.length) {
              node.paramFlowsToReturn.add(idx);
            }
          }
          if (node.paramFlowsToReturn.size > sizeBefore) changed = true;
        }
      }
    }
  }
}

function resolveCalleeName(
  expr: ts.Expression,
  checker: ts.TypeChecker,
): string | undefined {
  if (ts.isIdentifier(expr)) {
    const symbol = checker.getSymbolAtLocation(expr);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      return checker.getAliasedSymbol(symbol).getName();
    }
    return expr.text;
  }

  if (ts.isPropertyAccessExpression(expr)) {
    return expr.name.text;
  }

  return undefined;
}

function findEnclosingFunction(node: ts.Node): ts.Node | undefined {
  let current = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
}

function getFunctionName(node: ts.Node, sf: ts.SourceFile): string | undefined {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;

  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    node.parent &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  ) {
    return node.parent.name.text;
  }

  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    return node.name.text;
  }

  return undefined;
}

const USER_INPUT_PATTERNS = [
  'req.body', 'req.query', 'req.params', 'req.headers',
  'request.body', 'request.query', 'request.params',
  'ctx.request.body', 'ctx.query',
];

function containsUserInput(node: ts.Node, sf: ts.SourceFile): boolean {
  const text = node.getText(sf);
  return USER_INPUT_PATTERNS.some((p) => text.includes(p));
}
