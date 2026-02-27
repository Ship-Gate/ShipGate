import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import type { PropertyProver, PropertyProof, ProjectContext, TypeSafetyEvidence, Finding } from './types.js';

export class TypeSafetyProver implements PropertyProver {
  id = 'tier1-type-safety';
  name = 'TypeScript Type Safety';
  tier = 1 as const;

  async prove(project: ProjectContext): Promise<PropertyProof> {
    const start = Date.now();
    const evidence: TypeSafetyEvidence[] = [];
    const findings: Finding[] = [];

    // Check if project uses TypeScript
    const isTypeScript = project.sourceFiles.some(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    
    if (!isTypeScript) {
      return {
        property: 'type-safety',
        status: 'FAILED',
        summary: 'JavaScript project - add TypeScript for type safety verification',
        evidence: [],
        findings: [{
          file: project.rootPath,
          line: 0,
          severity: 'warning',
          message: 'Project uses JavaScript instead of TypeScript',
          suggestion: 'Migrate to TypeScript for type safety',
        }],
        method: 'tsc-validation',
        confidence: 'definitive',
        duration_ms: Date.now() - start,
      };
    }

    // Run tsc programmatically
    const tscResult = this.runTypeScript(project, findings);

    // Analyze type coverage
    for (const file of project.sourceFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        const fileEvidence = this.analyzeTypeCoverage(file, content);
        evidence.push(fileEvidence);

        // Check for type safety escape hatches
        this.checkTypeEscapeHatches(file, content, findings);
      } catch {
        // Skip files that can't be read
      }
    }

    const duration_ms = Date.now() - start;
    
    // Aggregate stats
    const totalFunctions = evidence.reduce((sum, e) => sum + e.totalFunctions, 0);
    const typedFunctions = evidence.reduce((sum, e) => sum + e.typedFunctions, 0);
    const anyUsages = evidence.reduce((sum, e) => sum + e.anyUsages, 0);
    const tsIgnores = evidence.reduce((sum, e) => sum + e.tsIgnores, 0);

    const criticalFindings = findings.filter(f => f.severity === 'error');

    let status: 'PROVEN' | 'PARTIAL' | 'FAILED';
    if (tscResult === 'pass' && anyUsages === 0 && tsIgnores === 0) {
      status = 'PROVEN';
    } else if (tscResult === 'pass') {
      status = 'PARTIAL';
    } else {
      status = 'FAILED';
    }

    return {
      property: 'type-safety',
      status,
      summary: status === 'PROVEN'
        ? `TypeScript strict mode passes. ${typedFunctions}/${totalFunctions} functions typed.`
        : `${criticalFindings.length} type error(s). ${anyUsages} any usages, ${tsIgnores} ts-ignore suppressions.`,
      evidence,
      findings,
      method: 'tsc-validation',
      confidence: 'definitive',
      duration_ms,
    };
  }

  private runTypeScript(project: ProjectContext, findings: Finding[]): 'pass' | 'fail' | 'not-typescript' {
    let configPath = project.tsconfigPath;
    
    if (!configPath) {
      configPath = path.join(project.rootPath, 'tsconfig.json');
      if (!fs.existsSync(configPath)) {
        findings.push({
          file: project.rootPath,
          line: 0,
          severity: 'warning',
          message: 'No tsconfig.json found',
          suggestion: 'Create tsconfig.json with strict mode enabled',
        });
        return 'not-typescript';
      }
    }

    try {
      // Read tsconfig
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      if (configFile.error) {
        const errorMsg = typeof configFile.error.messageText === 'string' 
          ? configFile.error.messageText 
          : configFile.error.messageText.messageText;
        findings.push({
          file: configPath,
          line: 0,
          severity: 'error',
          message: `tsconfig.json parse error: ${errorMsg}`,
        });
        return 'fail';
      }

      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
      );

      // Create program
      const program = ts.createProgram({
        rootNames: parsedConfig.fileNames,
        options: {
          ...parsedConfig.options,
          noEmit: true,
          strict: true, // Force strict mode for verification
        },
      });

      // Get diagnostics
      const diagnostics = [
        ...program.getSemanticDiagnostics(),
        ...program.getSyntacticDiagnostics(),
      ];

      // Filter out declaration file errors and node_modules
      const relevantDiagnostics = diagnostics.filter(d => {
        if (!d.file) return false;
        const fileName = d.file.fileName;
        return !fileName.includes('node_modules') && 
               !fileName.endsWith('.d.ts') &&
               project.sourceFiles.some(f => fileName.includes(f) || f.includes(fileName));
      });

      // Report errors
      for (const diagnostic of relevantDiagnostics.slice(0, 20)) { // Limit to first 20
        if (diagnostic.file) {
          const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start || 0);
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
          
          findings.push({
            file: diagnostic.file.fileName,
            line: line + 1,
            severity: diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
            message: `TypeScript: ${message}`,
          });
        }
      }

      return relevantDiagnostics.length === 0 ? 'pass' : 'fail';
    } catch (err) {
      findings.push({
        file: configPath,
        line: 0,
        severity: 'error',
        message: `Failed to run TypeScript compiler: ${err instanceof Error ? err.message : String(err)}`,
      });
      return 'fail';
    }
  }

  private analyzeTypeCoverage(file: string, content: string): TypeSafetyEvidence {
    const sourceFile = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    let totalFunctions = 0;
    let typedFunctions = 0;
    let anyUsages = 0;
    let tsIgnores = 0;
    let typeAssertions = 0;

    // Count @ts-ignore and @ts-expect-error
    const tsIgnoreMatches = content.match(/\/\/\s*@ts-ignore|\/\/\s*@ts-expect-error/g);
    tsIgnores = tsIgnoreMatches ? tsIgnoreMatches.length : 0;

    const visit = (node: ts.Node) => {
      // Count functions
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node)
      ) {
        totalFunctions++;
        
        // Check if function has explicit return type
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
          const isExported = node.modifiers?.some(
            m => m.kind === ts.SyntaxKind.ExportKeyword
          );
          
          if (isExported || ts.isFunctionDeclaration(node)) {
            if (node.type) {
              typedFunctions++;
            }
          } else {
            typedFunctions++; // Internal functions can be inferred
          }
        } else {
          // Arrow functions and expressions - check if typed
          const funcNode = node as ts.ArrowFunction | ts.FunctionExpression;
          if (funcNode.type) {
            typedFunctions++;
          }
        }
      }

      // Count 'any' type usage
      if (ts.isTypeReferenceNode(node)) {
        const typeName = ts.isIdentifier(node.typeName) ? node.typeName.text : node.typeName.getText(sourceFile);
        if (typeName === 'any') {
          anyUsages++;
        }
      }

      // Count 'as any' assertions
      if (ts.isAsExpression(node)) {
        const typeNode = node.type;
        const typeText = ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)
          ? typeNode.typeName.text
          : typeNode.getText(sourceFile);
        if (typeText === 'any') {
          typeAssertions++;
        }
      }

      // Count general type assertions
      if (ts.isAsExpression(node)) {
        typeAssertions++;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      file,
      totalFunctions,
      typedFunctions,
      anyUsages,
      tsIgnores,
      typeAssertions,
      tscResult: 'pass', // Will be set by overall tsc result
      errors: [],
    };
  }

  private checkTypeEscapeHatches(file: string, content: string, findings: Finding[]): void {
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Flag @ts-ignore
      if (line.includes('@ts-ignore')) {
        findings.push({
          file,
          line: lineNum,
          severity: 'warning',
          message: '@ts-ignore suppresses type errors',
          suggestion: 'Fix the type error instead of suppressing it',
        });
      }

      // Flag @ts-expect-error
      if (line.includes('@ts-expect-error')) {
        findings.push({
          file,
          line: lineNum,
          severity: 'warning',
          message: '@ts-expect-error suppresses type errors',
          suggestion: 'Verify this is intentional for testing',
        });
      }

      // Flag 'as any' casts
      if (line.match(/\bas\s+any\b/)) {
        findings.push({
          file,
          line: lineNum,
          severity: 'warning',
          message: 'Type assertion to "any" bypasses type safety',
          suggestion: 'Use proper types instead of "any"',
        });
      }

      // Flag public functions without return types (exported)
      const exportedFunctionMatch = line.match(/^export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*\{/);
      if (exportedFunctionMatch && !line.includes(':')) {
        findings.push({
          file,
          line: lineNum,
          severity: 'warning',
          message: 'Exported function without explicit return type',
          suggestion: 'Add explicit return type annotation',
        });
      }
    });
  }
}
