import * as fs from 'fs';
import * as ts from 'typescript';
import type { PropertyProver, PropertyProof, ProjectContext, ErrorHandlingEvidence, Finding } from './types.js';

export class ErrorHandlingProver implements PropertyProver {
  id = 'tier1-error-handling';
  name = 'Error Handling Completeness';
  tier = 1 as const;

  async prove(project: ProjectContext): Promise<PropertyProof> {
    const start = Date.now();
    const evidence: ErrorHandlingEvidence[] = [];
    const findings: Finding[] = [];

    for (const file of project.sourceFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        
        // Create TypeScript source file for AST analysis
        const sourceFile = ts.createSourceFile(
          file,
          content,
          ts.ScriptTarget.Latest,
          true
        );

        this.analyzeSourceFile(sourceFile, file, evidence, findings);
        
        // Text-based checks for patterns TS AST might miss
        this.analyzeTextPatterns(content, file, evidence, findings);
      } catch {
        // Skip files that can't be read
      }
    }

    const duration_ms = Date.now() - start;
    const criticalFindings = findings.filter(f => f.severity === 'error');
    const missingHandlers = evidence.filter(e => e.type === 'missing').length;

    return {
      property: 'error-handling',
      status: criticalFindings.length === 0 ? 'PROVEN' : (missingHandlers > 0 ? 'FAILED' : 'PARTIAL'),
      summary: criticalFindings.length === 0
        ? `All ${evidence.length} handlers have proper error handling`
        : `${criticalFindings.length} error handling gap(s) detected`,
      evidence,
      findings,
      method: 'static-ast-analysis',
      confidence: 'high',
      duration_ms,
    };
  }

  private analyzeSourceFile(
    sourceFile: ts.SourceFile,
    fileName: string,
    evidence: ErrorHandlingEvidence[],
    findings: Finding[]
  ): void {
    const visit = (node: ts.Node) => {
      // Check function declarations and expressions
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)
      ) {
        this.checkFunction(node, sourceFile, fileName, evidence, findings);
      }

      // Check try-catch blocks
      if (ts.isTryStatement(node)) {
        this.checkTryCatch(node, sourceFile, fileName, evidence, findings);
      }

      // Check promise chains
      if (ts.isCallExpression(node)) {
        this.checkPromiseChain(node, sourceFile, fileName, evidence, findings);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private checkFunction(
    node: ts.FunctionLikeDeclaration,
    sourceFile: ts.SourceFile,
    fileName: string,
    evidence: ErrorHandlingEvidence[],
    findings: Finding[]
  ): void {
    if (!node.body) return;

    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const isAsync = !!(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));
    const isRouteHandler = this.isRouteHandler(node, sourceFile);

    // Check if function has try-catch
    const hasTryCatch = this.hasTryCatchInBody(node.body);
    
    // For route handlers and async functions, require error handling
    if (isRouteHandler && !hasTryCatch) {
      const name = this.getFunctionName(node);
      
      evidence.push({
        file: fileName,
        line,
        handler: name,
        type: 'missing',
        hasStackLeak: false,
        hasMeaningfulHandler: false,
        context: this.getContext(sourceFile, node),
      });

      findings.push({
        file: fileName,
        line,
        severity: 'error',
        message: `Route handler "${name}" missing try-catch or error middleware`,
        suggestion: 'Wrap in try-catch or use error middleware',
      });
    }

    // Check async functions for unhandled promises
    if (isAsync && node.body && ts.isBlock(node.body)) {
      this.checkUnhandledPromises(node.body, sourceFile, fileName, evidence, findings);
    }
  }

  private checkTryCatch(
    node: ts.TryStatement,
    sourceFile: ts.SourceFile,
    fileName: string,
    evidence: ErrorHandlingEvidence[],
    findings: Finding[]
  ): void {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    
    if (!node.catchClause) {
      findings.push({
        file: fileName,
        line,
        severity: 'warning',
        message: 'Try block without catch clause',
        suggestion: 'Add catch clause',
      });
      return;
    }

    const catchBlock = node.catchClause.block;
    const hasMeaningfulHandler = this.isMeaningfulCatchBlock(catchBlock);
    const hasStackLeak = this.hasStackTraceLeak(catchBlock, sourceFile);

    evidence.push({
      file: fileName,
      line,
      handler: 'try-catch',
      type: 'try-catch',
      hasStackLeak,
      hasMeaningfulHandler,
      context: this.getContext(sourceFile, node.catchClause),
    });

    if (!hasMeaningfulHandler) {
      findings.push({
        file: fileName,
        line,
        severity: 'warning',
        message: 'Empty or ineffective catch block',
        suggestion: 'Add meaningful error handling (logging, recovery, or re-throw)',
      });
    }

    if (hasStackLeak) {
      findings.push({
        file: fileName,
        line,
        severity: 'error',
        message: 'Stack trace leaked in error response',
        suggestion: 'Remove error.stack from response body in production',
      });
    }
  }

  private checkPromiseChain(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    fileName: string,
    evidence: ErrorHandlingEvidence[],
    findings: Finding[]
  ): void {
    const text = node.getText(sourceFile);
    
    // Check for .catch() on promises
    if (ts.isPropertyAccessExpression(node.expression)) {
      const methodName = node.expression.name.text;
      
      if (methodName === 'then' || methodName === 'finally') {
        // Check if there's a .catch() somewhere in the chain
        let current: ts.Node = node;
        let hasCatch = false;
        
        while (current.parent && ts.isCallExpression(current.parent)) {
          const parent = current.parent;
          if (ts.isPropertyAccessExpression(parent.expression)) {
            if (parent.expression.name.text === 'catch') {
              hasCatch = true;
              break;
            }
          }
          current = parent;
        }

        if (!hasCatch && methodName === 'then') {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          
          evidence.push({
            file: fileName,
            line,
            handler: 'promise-chain',
            type: 'missing',
            hasStackLeak: false,
            hasMeaningfulHandler: false,
            context: text.substring(0, 100),
          });

          findings.push({
            file: fileName,
            line,
            severity: 'warning',
            message: 'Promise chain without .catch()',
            suggestion: 'Add .catch() handler to promise chain',
          });
        }
      }
    }
  }

  private analyzeTextPatterns(
    content: string,
    fileName: string,
    evidence: ErrorHandlingEvidence[],
    findings: Finding[]
  ): void {
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Check for error responses with status 200
      if (line.match(/catch.*\{/) && content.substring(content.indexOf(line)).match(/status\(200\)/)) {
        findings.push({
          file: fileName,
          line: lineNum,
          severity: 'error',
          message: 'Error response using HTTP 200 status',
          suggestion: 'Use appropriate error status code (4xx or 5xx)',
        });
      }

      // Check for floating promises (not awaited or caught)
      const floatingPromise = line.match(/^\s*(?!await|return|const|let|var)\w+\([^)]*\)\.then\(/);
      if (floatingPromise) {
        findings.push({
          file: fileName,
          line: lineNum,
          severity: 'warning',
          message: 'Floating promise - not awaited or assigned',
          suggestion: 'Await the promise or add .catch() handler',
        });
      }
    });
  }

  private hasTryCatchInBody(body: ts.Node): boolean {
    let found = false;
    
    const visit = (node: ts.Node) => {
      if (ts.isTryStatement(node)) {
        found = true;
      }
      if (!found) {
        ts.forEachChild(node, visit);
      }
    };
    
    visit(body);
    return found;
  }

  private isMeaningfulCatchBlock(block: ts.Block): boolean {
    // Empty block
    if (block.statements.length === 0) return false;

    // Only console.log
    if (block.statements.length === 1) {
      const stmt = block.statements[0];
      if (stmt && ts.isExpressionStatement(stmt)) {
        const expr = stmt.expression;
        if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)) {
          const text = expr.expression.getText();
          if (text === 'console.log' || text === 'console.error') {
            return false; // Just logging is not meaningful
          }
        }
      }
    }

    return true; // Has some handling
  }

  private hasStackTraceLeak(block: ts.Block, sourceFile: ts.SourceFile): boolean {
    let hasLeak = false;

    const visit = (node: ts.Node) => {
      const text = node.getText(sourceFile);
      
      // Check for error.stack in response
      if (text.includes('error.stack') || text.includes('err.stack') || text.includes('e.stack')) {
        // Check if it's in a response context
        if (text.includes('json(') || text.includes('send(') || text.includes('status(')) {
          hasLeak = true;
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(block);
    return hasLeak;
  }

  private isRouteHandler(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): boolean {
    // Check for Express/Fastify route handler pattern
    if (node.parameters.length >= 2) {
      const params = node.parameters;
      const firstParam = params[0];
      const secondParam = params[1];
      
      if (firstParam && secondParam) {
        const firstName = firstParam.name.getText(sourceFile);
        const secondName = secondParam.name.getText(sourceFile);
        
        if ((firstName === 'req' || firstName === 'request') && 
            (secondName === 'res' || secondName === 'response' || secondName === 'reply')) {
          return true;
        }
      }
    }

    // Check for Next.js API route
    const text = node.getText(sourceFile);
    if (text.includes('NextRequest') || text.includes('NextResponse')) {
      return true;
    }

    return false;
  }

  private checkUnhandledPromises(
    block: ts.Block,
    sourceFile: ts.SourceFile,
    fileName: string,
    evidence: ErrorHandlingEvidence[],
    findings: Finding[]
  ): void {
    const visit = (node: ts.Node) => {
      // Check for await expressions without try-catch
      if (ts.isAwaitExpression(node)) {
        // Check if we're inside a try block
        let current: ts.Node | undefined = node.parent;
        let inTry = false;
        
        while (current) {
          if (ts.isTryStatement(current)) {
            inTry = true;
            break;
          }
          current = current.parent;
        }

        if (!inTry) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          
          findings.push({
            file: fileName,
            line,
            severity: 'warning',
            message: 'Await expression without try-catch',
            suggestion: 'Wrap in try-catch or ensure function-level error handling',
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(block);
  }

  private getFunctionName(node: ts.FunctionLikeDeclaration): string {
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name.text;
    }
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    return 'anonymous';
  }

  private getContext(sourceFile: ts.SourceFile, node: ts.Node): string {
    return node.getText(sourceFile).substring(0, 100);
  }
}
