/**
 * API Call Extractor
 * 
 * Extracts external package method calls from TypeScript/JavaScript source code.
 */

import { Project, SyntaxKind, Node, type SourceFile } from 'ts-morph';
import type { ExtractedAPICall } from './types.js';

export class APICallExtractor {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: true,
        noEmit: true,
      },
    });
  }

  /**
   * Extract all API calls from source code
   */
  extractFromSource(filePath: string, sourceCode: string): ExtractedAPICall[] {
    const sourceFile = this.project.createSourceFile(filePath, sourceCode, { overwrite: true });
    const calls: ExtractedAPICall[] = [];

    // Build import map: symbol -> package
    const importMap = this.buildImportMap(sourceFile);

    // Find all call expressions and property accesses
    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const call = this.extractCallChain(node, importMap);
        if (call) {
          calls.push({
            file: filePath,
            line: node.getStartLineNumber(),
            package: call.package,
            callChain: call.chain,
            importedSymbol: call.symbol,
          });
        }
      }
    });

    return calls;
  }

  /**
   * Build map of imported symbols to their packages
   */
  private buildImportMap(sourceFile: SourceFile): Map<string, string> {
    const map = new Map<string, string>();

    sourceFile.getImportDeclarations().forEach((importDecl) => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // Only track external packages (not relative imports)
      if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
        const namedImports = importDecl.getNamedImports();
        namedImports.forEach((namedImport) => {
          const name = namedImport.getName();
          map.set(name, moduleSpecifier);
        });

        const defaultImport = importDecl.getDefaultImport();
        if (defaultImport) {
          map.set(defaultImport.getText(), moduleSpecifier);
        }

        const namespaceImport = importDecl.getNamespaceImport();
        if (namespaceImport) {
          map.set(namespaceImport.getText(), moduleSpecifier);
        }
      }
    });

    // Also check for require() calls
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpr) => {
      const expr = callExpr.getExpression();
      if (Node.isIdentifier(expr) && expr.getText() === 'require') {
        const args = callExpr.getArguments();
        if (args.length > 0 && Node.isStringLiteral(args[0])) {
          const moduleSpecifier = args[0].getLiteralValue();
          if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
            const parent = callExpr.getParent();
            if (Node.isVariableDeclaration(parent)) {
              const name = parent.getName();
              map.set(name, moduleSpecifier);
            }
          }
        }
      }
    });

    return map;
  }

  /**
   * Extract the full call chain from a call expression
   */
  private extractCallChain(
    node: Node,
    importMap: Map<string, string>
  ): { package: string; chain: string[]; symbol: string } | null {
    const chain: string[] = [];
    let current: Node | undefined = node;
    let rootSymbol: string | null = null;
    let packageName: string | null = null;

    // Walk up the chain collecting method/property names
    while (current) {
      if (Node.isCallExpression(current)) {
        const expr = current.getExpression();
        
        if (Node.isPropertyAccessExpression(expr)) {
          const name = expr.getName();
          chain.unshift(name);
          current = expr.getExpression();
        } else if (Node.isIdentifier(expr)) {
          const name = expr.getText();
          rootSymbol = name;
          packageName = importMap.get(name) || null;
          break;
        } else {
          current = expr;
        }
      } else if (Node.isPropertyAccessExpression(current)) {
        const name = current.getName();
        chain.unshift(name);
        current = current.getExpression();
      } else if (Node.isIdentifier(current)) {
        const name = current.getText();
        rootSymbol = name;
        packageName = importMap.get(name) || null;
        break;
      } else {
        break;
      }
    }

    // Only return if we found an external package
    if (packageName && rootSymbol) {
      return {
        package: packageName,
        chain,
        symbol: rootSymbol,
      };
    }

    return null;
  }

  /**
   * Extract calls from multiple files
   */
  extractFromFiles(files: Array<{ path: string; content: string }>): ExtractedAPICall[] {
    const allCalls: ExtractedAPICall[] = [];

    for (const file of files) {
      const calls = this.extractFromSource(file.path, file.content);
      allCalls.push(...calls);
    }

    return allCalls;
  }
}
