import ts from 'typescript';
import type {
  TaintSource,
  TaintFinding,
  TaintPathStep,
  TaintPathStepKind,
  SourceLocation,
  TaintSinkCategory,
} from './model.js';
import {
  SOURCE_PATTERNS,
  SINK_PATTERNS,
  SANITIZER_PATTERNS,
} from './patterns.js';
import type { SinkPattern, SanitizerPattern } from './patterns.js';

interface TaintedVar {
  source: TaintSource;
  path: TaintPathStep[];
  sanitizedFor: Set<TaintSinkCategory>;
}

interface FunctionSummary {
  name: string;
  params: string[];
  taintPropagatingParams: Set<number>;
}

export interface ModuleSummary {
  exports: Map<string, { taintedParams: number[]; returnsTaint: boolean }>;
  taintedExports: Set<string>;
}

export class TaintAnalyzer {
  private taintMap = new Map<string, TaintedVar>();
  private functionSummaries = new Map<string, FunctionSummary>();
  private moduleSummaries = new Map<string, ModuleSummary>();
  private findings: TaintFinding[] = [];
  private findingCounter = 0;
  private currentFile = '';
  private sourceFile: ts.SourceFile | null = null;
  private checker: ts.TypeChecker | null = null;

  analyzeFile(filePath: string, content: string): TaintFinding[] {
    this.resetFileState();
    this.moduleSummaries.clear();
    this.currentFile = filePath;
    this.sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    this.collectFunctionSummaries(this.sourceFile);
    this.analyzeNode(this.sourceFile);

    return [...this.findings];
  }

  analyzeProject(projectRoot: string, files: string[]): TaintFinding[] {
    const absolutePaths = files.map((f) =>
      f.startsWith('/') ? f : `${projectRoot}/${f}`,
    );

    const program = ts.createProgram(absolutePaths, {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
    });

    this.checker = program.getTypeChecker();
    const fileSet = new Set(absolutePaths);
    const projectSources: ts.SourceFile[] = [];

    for (const sf of program.getSourceFiles()) {
      if (sf.isDeclarationFile) continue;
      if (!fileSet.has(sf.fileName)) continue;
      projectSources.push(sf);
    }

    // FIRST PASS: collect function summaries for every module
    this.moduleSummaries.clear();
    for (const sf of projectSources) {
      this.currentFile = sf.fileName;
      this.sourceFile = sf;
      this.functionSummaries.clear();

      this.collectFunctionSummaries(sf);

      const modSummary: ModuleSummary = {
        exports: new Map(),
        taintedExports: new Set(),
      };

      for (const [name, summary] of this.functionSummaries) {
        if (this.isExported(sf, name)) {
          modSummary.exports.set(name, {
            taintedParams: [...summary.taintPropagatingParams],
            returnsTaint: summary.taintPropagatingParams.size > 0,
          });
        }
      }

      this.collectTaintedExports(sf, modSummary);
      this.moduleSummaries.set(sf.fileName, modSummary);
    }

    // SECOND PASS: analyze each file using cross-module summaries
    const allFindings: TaintFinding[] = [];

    for (const sf of projectSources) {
      this.resetFileState();
      this.currentFile = sf.fileName;
      this.sourceFile = sf;

      this.collectFunctionSummaries(sf);
      this.resolveImportSummaries(sf);
      this.analyzeNode(sf);
      allFindings.push(...this.findings);
    }

    this.checker = null;
    return allFindings;
  }

  private resetFileState(): void {
    this.taintMap.clear();
    this.functionSummaries.clear();
    this.findings = [];
    this.findingCounter = 0;
  }

  // ── Import resolution using the type checker ──

  private resolveImportSummaries(sf: ts.SourceFile): void {
    ts.forEachChild(sf, (node) => {
      if (!ts.isImportDeclaration(node)) return;
      if (!node.importClause) return;

      const resolvedPath = this.resolveModulePath(node, sf);
      if (!resolvedPath) return;

      const modSummary = this.moduleSummaries.get(resolvedPath);
      if (!modSummary) return;

      const { importClause } = node;

      if (importClause.name) {
        const defaultExport = modSummary.exports.get('default');
        if (defaultExport) {
          this.functionSummaries.set(importClause.name.text, {
            name: importClause.name.text,
            params: [],
            taintPropagatingParams: new Set(defaultExport.taintedParams),
          });
        }
      }

      if (importClause.namedBindings) {
        if (ts.isNamedImports(importClause.namedBindings)) {
          for (const spec of importClause.namedBindings.elements) {
            const originalName = (spec.propertyName ?? spec.name).text;
            const localName = spec.name.text;
            const exportInfo = modSummary.exports.get(originalName);
            if (exportInfo) {
              this.functionSummaries.set(localName, {
                name: localName,
                params: [],
                taintPropagatingParams: new Set(exportInfo.taintedParams),
              });
            }
          }
        } else if (ts.isNamespaceImport(importClause.namedBindings)) {
          const nsName = importClause.namedBindings.name.text;
          for (const [exportName, exportInfo] of modSummary.exports) {
            this.functionSummaries.set(`${nsName}.${exportName}`, {
              name: `${nsName}.${exportName}`,
              params: [],
              taintPropagatingParams: new Set(exportInfo.taintedParams),
            });
          }
        }
      }
    });
  }

  private resolveModulePath(
    importDecl: ts.ImportDeclaration,
    sf: ts.SourceFile,
  ): string | undefined {
    if (!this.checker) return undefined;

    const moduleSpecifier = importDecl.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) return undefined;

    const symbol = this.checker.getSymbolAtLocation(moduleSpecifier);
    if (!symbol) return undefined;

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return undefined;

    const declSf = declarations[0].getSourceFile();
    return declSf.fileName;
  }

  private isExported(sf: ts.SourceFile, name: string): boolean {
    if (!this.checker) return false;

    const sfSymbol = this.checker.getSymbolAtLocation(sf);
    if (!sfSymbol) return false;

    const exports = this.checker.getExportsOfModule(sfSymbol);
    return exports.some((e) => e.getName() === name);
  }

  private collectTaintedExports(
    sf: ts.SourceFile,
    modSummary: ModuleSummary,
  ): void {
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableStatement(node) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.initializer) {
            const text = decl.initializer.getText(sf);
            for (const sp of SOURCE_PATTERNS) {
              if (this.matches(text, sp.pattern)) {
                modSummary.taintedExports.add(decl.name.text);
                break;
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }

  // ── First pass: build function summaries for interprocedural analysis ──

  private collectFunctionSummaries(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name) {
      this.functionSummaries.set(
        node.name.text,
        this.buildSummary(node, node.name.text),
      );
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    ) {
      this.functionSummaries.set(
        node.name.text,
        this.buildSummary(node.initializer, node.name.text),
      );
    }

    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      this.functionSummaries.set(
        node.name.text,
        this.buildSummary(node, node.name.text),
      );
    }

    ts.forEachChild(node, (child) => this.collectFunctionSummaries(child));
  }

  private buildSummary(
    node:
      | ts.FunctionDeclaration
      | ts.ArrowFunction
      | ts.FunctionExpression
      | ts.MethodDeclaration,
    name: string,
  ): FunctionSummary {
    const params = (node.parameters ?? []).map((p) =>
      ts.isIdentifier(p.name) ? p.name.text : '',
    );
    const propagating = new Set<number>();

    const scanReturns = (n: ts.Node) => {
      if (ts.isReturnStatement(n) && n.expression) {
        const text = n.expression.getText(this.sourceFile!);
        params.forEach((p, i) => {
          if (p && text.includes(p)) propagating.add(i);
        });
      }
      ts.forEachChild(n, scanReturns);
    };

    if (node.body) {
      if (ts.isBlock(node.body)) {
        ts.forEachChild(node.body, scanReturns);
      } else {
        const text = node.body.getText(this.sourceFile!);
        params.forEach((p, i) => {
          if (p && text.includes(p)) propagating.add(i);
        });
      }
    }

    return { name, params, taintPropagatingParams: propagating };
  }

  // ── Second pass: walk AST and track taint ──

  private analyzeNode(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      this.handleVariableDeclaration(node);
    }

    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (
        op === ts.SyntaxKind.EqualsToken ||
        op === ts.SyntaxKind.PlusEqualsToken
      ) {
        this.handleAssignment(node);
      }
    }

    if (ts.isCallExpression(node)) {
      this.handleCallExpression(node);
    }

    ts.forEachChild(node, (child) => this.analyzeNode(child));
  }

  private handleVariableDeclaration(node: ts.VariableDeclaration): void {
    if (!node.initializer) return;

    const sanitizerResult = this.checkSanitizer(node.initializer);
    if (sanitizerResult) {
      const sanitized = new Set(sanitizerResult.taint.sanitizedFor);
      for (const cat of sanitizerResult.sanitizer.sanitizes) {
        sanitized.add(cat);
      }
      this.setTaint(node.name, {
        source: sanitizerResult.taint.source,
        path: [...sanitizerResult.taint.path, this.step(node, 'call')],
        sanitizedFor: sanitized,
      });
      return;
    }

    const taint = this.resolveTaint(node.initializer);
    if (taint) {
      this.setTaint(node.name, {
        source: taint.source,
        path: [...taint.path, this.step(node, 'assignment')],
        sanitizedFor: new Set(taint.sanitizedFor),
      });
    }
  }

  private handleAssignment(node: ts.BinaryExpression): void {
    const lhsText = node.left.getText(this.sourceFile!);

    for (const sp of SINK_PATTERNS) {
      if (this.matches(lhsText, sp.pattern)) {
        const taint = this.resolveTaint(node.right);
        if (taint && !taint.sanitizedFor.has(sp.category)) {
          this.findings.push(this.buildFinding(taint, node, sp));
        }
        return;
      }
    }

    const sanitizerResult = this.checkSanitizer(node.right);
    if (sanitizerResult) {
      const sanitized = new Set(sanitizerResult.taint.sanitizedFor);
      for (const cat of sanitizerResult.sanitizer.sanitizes) {
        sanitized.add(cat);
      }
      const varName = ts.isIdentifier(node.left) ? node.left.text : lhsText;
      this.taintMap.set(varName, {
        source: sanitizerResult.taint.source,
        path: [...sanitizerResult.taint.path, this.step(node, 'call')],
        sanitizedFor: sanitized,
      });
      return;
    }

    const taint = this.resolveTaint(node.right);
    if (taint) {
      const varName = ts.isIdentifier(node.left) ? node.left.text : lhsText;
      this.taintMap.set(varName, {
        source: taint.source,
        path: [...taint.path, this.step(node, 'assignment')],
        sanitizedFor: new Set(taint.sanitizedFor),
      });
    }
  }

  private handleCallExpression(node: ts.CallExpression): void {
    const calleeText = node.expression.getText(this.sourceFile!);
    const sinkMatch = this.matchSink(calleeText);
    if (!sinkMatch) return;

    for (const arg of node.arguments) {
      const taint = this.resolveTaint(arg);
      if (taint && !taint.sanitizedFor.has(sinkMatch.category)) {
        this.findings.push(this.buildFinding(taint, node, sinkMatch));
        return;
      }
    }
  }

  // ── Taint resolution: determine if an expression carries taint ──

  private resolveTaint(node: ts.Node): TaintedVar | undefined {
    if (ts.isIdentifier(node)) {
      return this.taintMap.get(node.text);
    }

    if (ts.isPropertyAccessExpression(node)) {
      const chain = this.propertyChain(node);
      const source = this.matchSource(chain, node);
      if (source) {
        return {
          source,
          path: [this.step(node, 'property-access')],
          sanitizedFor: new Set(),
        };
      }
      return this.taintMap.get(chain) ?? this.resolveTaint(node.expression);
    }

    if (ts.isElementAccessExpression(node)) {
      return this.resolveTaint(node.expression);
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      return this.resolveTaint(node.left) ?? this.resolveTaint(node.right);
    }

    if (ts.isTemplateExpression(node)) {
      for (const span of node.templateSpans) {
        const t = this.resolveTaint(span.expression);
        if (t) return { ...t, path: [...t.path, this.step(node, 'template-literal')] };
      }
    }

    if (ts.isCallExpression(node)) {
      return this.resolveCallTaint(node);
    }

    if (ts.isConditionalExpression(node)) {
      return this.resolveTaint(node.whenTrue) ?? this.resolveTaint(node.whenFalse);
    }

    if (ts.isAwaitExpression(node)) {
      return this.resolveAwaitTaint(node);
    }

    const inner = this.unwrap(node);
    if (inner) return this.resolveTaint(inner);

    return undefined;
  }

  // ── Async/await and Promise taint propagation ──

  private resolveAwaitTaint(node: ts.AwaitExpression): TaintedVar | undefined {
    const inner = node.expression;
    const taint = this.resolveTaint(inner);
    if (taint) {
      return {
        source: taint.source,
        path: [...taint.path, this.step(node, 'call')],
        sanitizedFor: new Set(taint.sanitizedFor),
      };
    }
    return undefined;
  }

  private resolveCallTaint(node: ts.CallExpression): TaintedVar | undefined {
    const fullText = node.getText(this.sourceFile!);
    for (const sp of SOURCE_PATTERNS) {
      if (this.matches(fullText, sp.pattern)) {
        return {
          source: {
            category: sp.category,
            location: this.loc(node),
            expression: fullText,
            description: sp.description,
          },
          path: [this.step(node, 'call')],
          sanitizedFor: new Set(),
        };
      }
    }

    // Handle .then() callbacks: promise.then(value => ...) treats `value`
    // as receiving taint from the promise expression.
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'then') {
      const promiseExpr = node.expression.expression;
      const promiseTaint = this.resolveTaint(promiseExpr);
      if (promiseTaint && node.arguments.length > 0) {
        const callback = node.arguments[0];
        if (
          (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
          callback.parameters.length > 0
        ) {
          const paramName = callback.parameters[0].name;
          if (ts.isIdentifier(paramName)) {
            this.taintMap.set(paramName.text, {
              source: promiseTaint.source,
              path: [...promiseTaint.path, this.step(node, 'call')],
              sanitizedFor: new Set(promiseTaint.sanitizedFor),
            });
          }
        }
        return promiseTaint;
      }
    }

    const calleeName = this.resolveCalleeName(node.expression);

    if (calleeName) {
      // Try local function summaries first, then cross-module summaries
      const summary = this.functionSummaries.get(calleeName);
      if (summary) {
        for (const idx of summary.taintPropagatingParams) {
          const arg = node.arguments[idx];
          if (arg) {
            const t = this.resolveTaint(arg);
            if (t) {
              return {
                source: t.source,
                path: [...t.path, this.step(node, 'call')],
                sanitizedFor: new Set(t.sanitizedFor),
              };
            }
          }
        }
      }

      // Cross-module: resolve the callee symbol via the type checker
      if (this.checker && this.sourceFile) {
        const importedTaint = this.resolveImportedCallTaint(node, calleeName);
        if (importedTaint) return importedTaint;
      }
    }

    return undefined;
  }

  private resolveImportedCallTaint(
    node: ts.CallExpression,
    calleeName: string,
  ): TaintedVar | undefined {
    if (!this.checker) return undefined;

    let symbol: ts.Symbol | undefined;

    if (ts.isIdentifier(node.expression)) {
      symbol = this.checker.getSymbolAtLocation(node.expression);
    } else if (ts.isPropertyAccessExpression(node.expression)) {
      symbol = this.checker.getSymbolAtLocation(node.expression);
    }

    if (!symbol) return undefined;

    // Follow aliases (import bindings) to the original declaration
    if (symbol.flags & ts.SymbolFlags.Alias) {
      symbol = this.checker.getAliasedSymbol(symbol);
    }

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return undefined;

    const declFile = declarations[0].getSourceFile().fileName;
    if (declFile === this.currentFile) return undefined;

    const modSummary = this.moduleSummaries.get(declFile);
    if (!modSummary) return undefined;

    const exportName = symbol.getName();
    const exportInfo = modSummary.exports.get(exportName);
    if (!exportInfo) return undefined;

    for (const paramIdx of exportInfo.taintedParams) {
      const arg = node.arguments[paramIdx];
      if (arg) {
        const t = this.resolveTaint(arg);
        if (t) {
          return {
            source: t.source,
            path: [...t.path, this.step(node, 'call')],
            sanitizedFor: new Set(t.sanitizedFor),
          };
        }
      }
    }

    return undefined;
  }

  private resolveCalleeName(expr: ts.Expression): string | undefined {
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr)) {
      const obj = this.resolveCalleeName(expr.expression);
      return obj ? `${obj}.${expr.name.text}` : expr.name.text;
    }
    return undefined;
  }

  // ── Sanitizer detection ──

  private checkSanitizer(
    node: ts.Node,
  ): { sanitizer: SanitizerPattern; taint: TaintedVar } | undefined {
    if (!ts.isCallExpression(node)) return undefined;
    const calleeText = node.expression.getText(this.sourceFile!);

    for (const sp of SANITIZER_PATTERNS) {
      if (this.matches(calleeText, sp.pattern)) {
        const firstArg = node.arguments[0];
        if (!firstArg) continue;
        const argTaint = this.resolveTaint(firstArg);
        if (argTaint) return { sanitizer: sp, taint: argTaint };
      }
    }

    return undefined;
  }

  // ── Pattern matching helpers ──

  private matchSource(
    text: string,
    node: ts.Node,
  ): TaintSource | undefined {
    for (const sp of SOURCE_PATTERNS) {
      if (this.matches(text, sp.pattern)) {
        return {
          category: sp.category,
          location: this.loc(node),
          expression: text,
          description: sp.description,
        };
      }
    }
    return undefined;
  }

  private matchSink(calleeText: string): SinkPattern | undefined {
    for (const sp of SINK_PATTERNS) {
      if (this.matches(calleeText, sp.pattern)) return sp;
    }
    return undefined;
  }

  private matches(text: string, pattern: RegExp | string): boolean {
    if (typeof pattern === 'string') {
      return text === pattern || text.startsWith(pattern + '.') || text.startsWith(pattern + '[');
    }
    return pattern.test(text);
  }

  // ── Taint assignment (handles destructuring) ──

  private setTaint(name: ts.BindingName, taint: TaintedVar): void {
    if (ts.isIdentifier(name)) {
      this.taintMap.set(name.text, taint);
      return;
    }

    if (ts.isObjectBindingPattern(name)) {
      for (const el of name.elements) {
        if (ts.isIdentifier(el.name)) {
          this.taintMap.set(el.name.text, {
            source: taint.source,
            path: [...taint.path],
            sanitizedFor: new Set(taint.sanitizedFor),
          });
        }
      }
      return;
    }

    if (ts.isArrayBindingPattern(name)) {
      for (const el of name.elements) {
        if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) {
          this.taintMap.set(el.name.text, {
            source: taint.source,
            path: [...taint.path],
            sanitizedFor: new Set(taint.sanitizedFor),
          });
        }
      }
    }
  }

  // ── Utility helpers ──

  private unwrap(node: ts.Node): ts.Expression | undefined {
    if (ts.isParenthesizedExpression(node)) return node.expression;
    if (ts.isNonNullExpression(node)) return node.expression;
    if (ts.isAsExpression(node)) return node.expression;
    if (ts.isSpreadElement(node)) return node.expression;
    return undefined;
  }

  private propertyChain(node: ts.Node): string {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node)) {
      return `${this.propertyChain(node.expression)}.${node.name.text}`;
    }
    if (ts.isElementAccessExpression(node)) {
      return this.propertyChain(node.expression);
    }
    return node.getText(this.sourceFile!);
  }

  private loc(node: ts.Node): SourceLocation {
    const { line, character } =
      this.sourceFile!.getLineAndCharacterOfPosition(node.getStart(this.sourceFile!));
    return { file: this.currentFile, line: line + 1, column: character + 1 };
  }

  private step(node: ts.Node, kind: TaintPathStepKind): TaintPathStep {
    return {
      location: this.loc(node),
      expression: node.getText(this.sourceFile!).slice(0, 120),
      kind,
    };
  }

  private buildFinding(
    taint: TaintedVar,
    sinkNode: ts.Node,
    sinkPattern: SinkPattern,
  ): TaintFinding {
    this.findingCounter++;
    const sinkLoc = this.loc(sinkNode);
    const sinkExpr = sinkNode.getText(this.sourceFile!).slice(0, 200);

    return {
      id: `TAINT-${String(this.findingCounter).padStart(3, '0')}`,
      severity: sinkPattern.severity,
      title: `Unsanitized ${taint.source.category} flows to ${sinkPattern.category}`,
      description:
        `Tainted data from ${taint.source.expression} ` +
        `reaches ${sinkPattern.description} without proper sanitization.`,
      flow: {
        source: taint.source,
        sink: {
          category: sinkPattern.category,
          location: sinkLoc,
          expression: sinkExpr,
          description: sinkPattern.description,
        },
        path: taint.path,
        sanitizers: [],
      },
      remediation: remediationFor(sinkPattern.category),
      cwe: cweFor(sinkPattern.category),
    };
  }
}

const REMEDIATION: Record<TaintSinkCategory, string> = {
  'sql-query': 'Use parameterized queries or an ORM instead of string interpolation.',
  'shell-exec': 'Avoid passing user input to shell commands. Use execFile with explicit arguments.',
  'html-render': 'Sanitize with DOMPurify or use a template engine with auto-escaping.',
  'eval': 'Never pass user input to eval() or Function(). Use JSON.parse for data.',
  'file-write': 'Validate and sanitize file paths. Use path.resolve with a base directory.',
  'http-response': 'Validate response data with a schema validator (zod/joi).',
  'log-output': 'Redact PII and sensitive data before logging.',
};

const CWE: Record<TaintSinkCategory, string> = {
  'sql-query': 'CWE-89', 'shell-exec': 'CWE-78', 'html-render': 'CWE-79',
  'eval': 'CWE-95', 'file-write': 'CWE-22', 'http-response': 'CWE-116',
  'log-output': 'CWE-532',
};

function remediationFor(category: TaintSinkCategory): string { return REMEDIATION[category]; }
function cweFor(category: TaintSinkCategory): string { return CWE[category]; }
