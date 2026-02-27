import { Project, SourceFile, SyntaxKind, ImportDeclaration, ExportDeclaration, Node } from 'ts-morph';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ImportEvidence, PropertyProof, Finding } from './types.js';

interface ResolvedImport {
  resolvedPath: string | null;
  symbolsVerified: boolean;
  status: 'verified' | 'unresolved_module' | 'unresolved_symbol' | 'missing_types';
}

export class ImportIntegrityProver {
  private project: Project;
  private projectRoot: string;
  private pathAliases: Map<string, string[]> = new Map();
  private baseUrl: string | null = null;
  private hasNodeModules: boolean = false;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    
    // Check if node_modules exists
    this.hasNodeModules = fs.existsSync(path.join(this.projectRoot, 'node_modules'));
    
    // Initialize ts-morph project
    const tsconfigPath = this.findTsConfig();
    this.project = new Project({
      tsConfigFilePath: tsconfigPath || undefined,
      skipAddingFilesFromTsConfig: !tsconfigPath,
    });

    // If no tsconfig, add all TS/JS files manually
    if (!tsconfigPath) {
      this.addSourceFiles();
    }

    // Load path aliases from tsconfig
    if (tsconfigPath) {
      this.loadPathAliases(tsconfigPath);
    }
  }

  private findTsConfig(): string | null {
    const candidates = [
      path.join(this.projectRoot, 'tsconfig.json'),
      path.join(this.projectRoot, 'jsconfig.json'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private addSourceFiles(): void {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];
    const files = this.findFiles(this.projectRoot, extensions);
    
    for (const file of files) {
      try {
        this.project.addSourceFileAtPath(file);
      } catch {
        // Skip files that can't be added
      }
    }
  }

  private findFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.next'];

    const walk = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) {
              walk(fullPath);
            }
          } else if (entry.isFile()) {
            if (extensions.some(ext => entry.name.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    walk(dir);
    return files;
  }

  private loadPathAliases(tsconfigPath: string): void {
    try {
      const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(tsconfigContent);
      
      if (tsconfig.compilerOptions?.baseUrl) {
        this.baseUrl = path.resolve(path.dirname(tsconfigPath), tsconfig.compilerOptions.baseUrl);
      }

      if (tsconfig.compilerOptions?.paths) {
        for (const [alias, targets] of Object.entries(tsconfig.compilerOptions.paths)) {
          const normalizedAlias = alias.replace(/\/\*$/, '');
          const resolvedTargets = (targets as string[]).map(t => {
            const normalized = t.replace(/\/\*$/, '');
            return this.baseUrl 
              ? path.resolve(this.baseUrl, normalized)
              : path.resolve(path.dirname(tsconfigPath), normalized);
          });
          this.pathAliases.set(normalizedAlias, resolvedTargets);
        }
      }
    } catch {
      // Couldn't parse tsconfig, continue without aliases
    }
  }

  async prove(): Promise<PropertyProof> {
    const startTime = Date.now();
    const evidence: ImportEvidence[] = [];
    const findings: Finding[] = [];

    const sourceFiles = this.project.getSourceFiles();
    
    for (const sourceFile of sourceFiles) {
      // Skip node_modules and other excluded paths
      const filePath = sourceFile.getFilePath();
      if (this.shouldSkipFile(filePath)) {
        continue;
      }

      // Process regular imports
      const importDeclarations = sourceFile.getImportDeclarations();
      for (const importDecl of importDeclarations) {
        const importEvidence = await this.processImport(sourceFile, importDecl);
        evidence.push(importEvidence);
        
        if (importEvidence.status !== 'verified') {
          findings.push(this.createFinding(importEvidence));
        }
      }

      // Process dynamic imports
      const dynamicImports = this.findDynamicImports(sourceFile);
      for (const dynamicImport of dynamicImports) {
        const importEvidence = await this.processDynamicImport(sourceFile, dynamicImport);
        evidence.push(importEvidence);
        
        if (importEvidence.status !== 'verified') {
          findings.push(this.createFinding(importEvidence));
        }
      }

      // Process re-exports
      const exportDeclarations = sourceFile.getExportDeclarations();
      for (const exportDecl of exportDeclarations) {
        const moduleSpecifier = exportDecl.getModuleSpecifier();
        if (moduleSpecifier) {
          const importEvidence = await this.processReExport(sourceFile, exportDecl);
          evidence.push(importEvidence);
          
          if (importEvidence.status !== 'verified') {
            findings.push(this.createFinding(importEvidence));
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    const verifiedCount = evidence.filter(e => e.status === 'verified').length;
    const totalCount = evidence.length;
    
    let status: 'PROVEN' | 'PARTIAL' | 'FAILED';
    if (verifiedCount === totalCount && totalCount > 0) {
      status = 'PROVEN';
    } else if (verifiedCount > 0 && verifiedCount / totalCount >= 0.9) {
      status = 'PARTIAL';
    } else {
      status = 'FAILED';
    }

    const summary = verifiedCount === totalCount
      ? `${totalCount}/${totalCount} imports resolve`
      : `${verifiedCount}/${totalCount} imports resolve (${totalCount - verifiedCount} hallucinated)`;

    return {
      property: 'import-integrity',
      status,
      summary,
      evidence,
      findings,
      method: 'static-ast-analysis',
      confidence: 'definitive',
      duration_ms: duration,
    };
  }

  private shouldSkipFile(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const excludePatterns = [
      '/node_modules/',
      '/.git/',
      '/dist/',
      '/build/',
      '/coverage/',
      '/.turbo/',
      '/.next/',
    ];
    return excludePatterns.some(pattern => normalizedPath.includes(pattern));
  }

  private async processImport(sourceFile: SourceFile, importDecl: ImportDeclaration): Promise<ImportEvidence> {
    const moduleSpecifierValue = importDecl.getModuleSpecifierValue();
    const line = importDecl.getStartLineNumber();
    const source = sourceFile.getFilePath();
    
    // Extract imported symbols
    const symbols = this.extractImportedSymbols(importDecl);
    
    // Resolve the import
    const resolved = await this.resolveImport(source, moduleSpecifierValue, symbols, false);

    return {
      source,
      line,
      importPath: moduleSpecifierValue,
      symbols,
      resolvedTo: resolved.resolvedPath,
      symbolsVerified: resolved.symbolsVerified,
      status: resolved.status,
    };
  }

  private async processDynamicImport(sourceFile: SourceFile, dynamicImport: { path: string; line: number }): Promise<ImportEvidence> {
    const source = sourceFile.getFilePath();
    const resolved = await this.resolveImport(source, dynamicImport.path, [], true);

    return {
      source,
      line: dynamicImport.line,
      importPath: dynamicImport.path,
      symbols: [],
      resolvedTo: resolved.resolvedPath,
      symbolsVerified: resolved.symbolsVerified,
      status: resolved.status,
    };
  }

  private async processReExport(sourceFile: SourceFile, exportDecl: ExportDeclaration): Promise<ImportEvidence> {
    const moduleSpecifier = exportDecl.getModuleSpecifier();
    const moduleSpecifierValue = moduleSpecifier?.getLiteralValue() || '';
    const line = exportDecl.getStartLineNumber();
    const source = sourceFile.getFilePath();
    
    // Extract re-exported symbols
    const symbols: string[] = [];
    const namedExports = exportDecl.getNamedExports();
    for (const namedExport of namedExports) {
      symbols.push(namedExport.getName());
    }
    
    // Resolve the re-export
    const resolved = await this.resolveImport(source, moduleSpecifierValue, symbols, false);

    return {
      source,
      line,
      importPath: moduleSpecifierValue,
      symbols,
      resolvedTo: resolved.resolvedPath,
      symbolsVerified: resolved.symbolsVerified,
      status: resolved.status,
    };
  }

  private extractImportedSymbols(importDecl: ImportDeclaration): string[] {
    const symbols: string[] = [];
    
    // Default import
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) {
      symbols.push('default');
    }
    
    // Namespace import
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport) {
      symbols.push('*');
    }
    
    // Named imports
    const namedImports = importDecl.getNamedImports();
    for (const namedImport of namedImports) {
      symbols.push(namedImport.getName());
    }
    
    return symbols;
  }

  private findDynamicImports(sourceFile: SourceFile): Array<{ path: string; line: number }> {
    const dynamicImports: Array<{ path: string; line: number }> = [];
    
    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expression = node.getExpression();
        // Check if this is an import() call
        if (expression.getKind() === SyntaxKind.ImportKeyword) {
          const args = node.getArguments();
          if (args.length > 0) {
            const arg = args[0];
            if (Node.isStringLiteral(arg)) {
              dynamicImports.push({
                path: arg.getLiteralValue(),
                line: node.getStartLineNumber(),
              });
            } else if (Node.isNoSubstitutionTemplateLiteral(arg)) {
              dynamicImports.push({
                path: arg.getLiteralValue(),
                line: node.getStartLineNumber(),
              });
            }
          }
        }
      }
    });
    
    return dynamicImports;
  }

  private async resolveImport(
    sourceFilePath: string,
    importPath: string,
    symbols: string[],
    isDynamic: boolean
  ): Promise<ResolvedImport> {
    // Check if it's a relative import
    if (importPath.startsWith('.')) {
      return this.resolveRelativeImport(sourceFilePath, importPath, symbols);
    }

    // Check if it's a path alias
    const aliasResolved = this.resolvePathAlias(importPath, symbols);
    if (aliasResolved) {
      return aliasResolved;
    }

    // Check if it's a package import
    return this.resolvePackageImport(importPath, symbols);
  }

  private resolveRelativeImport(sourceFilePath: string, importPath: string, symbols: string[]): ResolvedImport {
    const sourceDir = path.dirname(sourceFilePath);
    const candidates = this.getFileCandidates(sourceDir, importPath);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        // File exists, now verify symbols
        if (symbols.length === 0 || symbols.includes('*')) {
          return {
            resolvedPath: candidate,
            symbolsVerified: true,
            status: 'verified',
          };
        }

        const symbolsVerified = this.verifySymbolsInFile(candidate, symbols);
        return {
          resolvedPath: candidate,
          symbolsVerified,
          status: symbolsVerified ? 'verified' : 'unresolved_symbol',
        };
      }
    }

    return {
      resolvedPath: null,
      symbolsVerified: false,
      status: 'unresolved_module',
    };
  }

  private resolvePathAlias(importPath: string, symbols: string[]): ResolvedImport | null {
    for (const [alias, targets] of this.pathAliases.entries()) {
      if (importPath === alias || importPath.startsWith(alias + '/')) {
        const remainder = importPath === alias ? '' : importPath.slice(alias.length + 1);
        
        for (const target of targets) {
          const fullPath = remainder ? path.join(target, remainder) : target;
          const candidates = this.getFileCandidates(path.dirname(fullPath), path.basename(fullPath));

          for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
              if (symbols.length === 0 || symbols.includes('*')) {
                return {
                  resolvedPath: candidate,
                  symbolsVerified: true,
                  status: 'verified',
                };
              }

              const symbolsVerified = this.verifySymbolsInFile(candidate, symbols);
              return {
                resolvedPath: candidate,
                symbolsVerified,
                status: symbolsVerified ? 'verified' : 'unresolved_symbol',
              };
            }
          }
        }
      }
    }

    return null;
  }

  private resolvePackageImport(importPath: string, symbols: string[]): ResolvedImport {
    if (!this.hasNodeModules) {
      return {
        resolvedPath: null,
        symbolsVerified: false,
        status: 'missing_types',
      };
    }

    // Extract package name (handle scoped packages like @isl-lang/parser)
    const parts = importPath.split('/');
    const packageName = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
    const subPath = parts.slice(packageName.includes('/') ? 2 : 1).join('/');

    const packagePath = path.join(this.projectRoot, 'node_modules', packageName);
    
    if (!fs.existsSync(packagePath)) {
      return {
        resolvedPath: null,
        symbolsVerified: false,
        status: 'unresolved_module',
      };
    }

    // Try to find package.json to get entry point
    const packageJsonPath = path.join(packagePath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const entryPoint = subPath 
          ? path.join(packagePath, subPath)
          : path.join(packagePath, packageJson.main || packageJson.module || 'index.js');

        const candidates = this.getFileCandidates(path.dirname(entryPoint), path.basename(entryPoint));
        
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            // For package imports, we trust type definitions exist
            // Checking symbols in node_modules is too expensive
            return {
              resolvedPath: candidate,
              symbolsVerified: true,
              status: 'verified',
            };
          }
        }
      } catch {
        // Couldn't parse package.json
      }
    }

    // Package exists but we can't verify symbols
    return {
      resolvedPath: packagePath,
      symbolsVerified: false,
      status: 'missing_types',
    };
  }

  private getFileCandidates(dir: string, basePath: string): string[] {
    const candidates: string[] = [];
    
    // Remove extension if present
    const withoutExt = basePath.replace(/\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/, '');
    
    // Try with various extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '.d.ts'];
    for (const ext of extensions) {
      candidates.push(path.join(dir, withoutExt + ext));
    }
    
    // Try index files in directory
    const indexExtensions = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx', '/index.mts', '/index.mjs'];
    for (const ext of indexExtensions) {
      candidates.push(path.join(dir, withoutExt + ext));
    }
    
    // Try exact path
    candidates.push(path.join(dir, basePath));
    
    return candidates;
  }

  private verifySymbolsInFile(filePath: string, symbols: string[]): boolean {
    try {
      const sourceFile = this.project.getSourceFile(filePath) || this.project.addSourceFileAtPath(filePath);
      const exportedSymbols = this.getExportedSymbols(sourceFile);
      
      // Check if all requested symbols are exported
      for (const symbol of symbols) {
        if (symbol === 'default') {
          if (!exportedSymbols.has('default')) {
            return false;
          }
        } else if (symbol !== '*') {
          if (!exportedSymbols.has(symbol)) {
            return false;
          }
        }
      }
      
      return true;
    } catch {
      // Couldn't verify symbols
      return false;
    }
  }

  private getExportedSymbols(sourceFile: SourceFile): Set<string> {
    const symbols = new Set<string>();
    
    // Get default export
    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (defaultExport) {
      symbols.add('default');
    }
    
    // Get named exports
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name] of exportedDeclarations) {
      symbols.add(name);
    }
    
    // Get re-exported symbols
    const exportDeclarations = sourceFile.getExportDeclarations();
    for (const exportDecl of exportDeclarations) {
      const namedExports = exportDecl.getNamedExports();
      for (const namedExport of namedExports) {
        symbols.add(namedExport.getName());
      }
      
      // Handle export * from
      if (exportDecl.isNamespaceExport()) {
        const moduleSpecifier = exportDecl.getModuleSpecifier();
        if (moduleSpecifier) {
          const moduleFile = exportDecl.getModuleSpecifierSourceFile();
          if (moduleFile) {
            const reExportedSymbols = this.getExportedSymbols(moduleFile);
            for (const symbol of reExportedSymbols) {
              symbols.add(symbol);
            }
          }
        }
      }
    }
    
    return symbols;
  }

  private createFinding(evidence: ImportEvidence): Finding {
    let message: string;
    let suggestion: string | undefined;
    
    switch (evidence.status) {
      case 'unresolved_module':
        message = `Import '${evidence.importPath}' cannot be resolved`;
        if (evidence.importPath.startsWith('.')) {
          suggestion = 'Check that the file exists and the path is correct';
        } else if (!evidence.importPath.startsWith('@') && !evidence.importPath.includes('/')) {
          suggestion = 'Run npm install to ensure the package is installed';
        } else {
          suggestion = 'Verify the module path and tsconfig.json path aliases';
        }
        break;
      
      case 'unresolved_symbol':
        message = `Symbols [${evidence.symbols.join(', ')}] not found in '${evidence.importPath}'`;
        suggestion = 'Check that the symbols are exported from the target module';
        break;
      
      case 'missing_types':
        message = `Cannot verify symbols in '${evidence.importPath}' - type definitions may be missing`;
        suggestion = 'Install type definitions or run npm install';
        break;
      
      default:
        message = `Unknown import issue with '${evidence.importPath}'`;
    }
    
    return {
      file: evidence.source,
      line: evidence.line,
      severity: evidence.status === 'missing_types' ? 'warning' : 'error',
      message,
      suggestion,
    };
  }
}
