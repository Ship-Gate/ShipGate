import ts from 'typescript';
import { SharedStateAnalyzer } from './analyzers/shared-state.js';
import { ToctouAnalyzer } from './analyzers/toctou.js';
import { DatabaseRaceAnalyzer } from './analyzers/database-race.js';
import { AsyncPatternsAnalyzer } from './analyzers/async-patterns.js';
import type { Analyzer, RaceFinding, RaceDetectorConfig } from './types.js';

const ANALYZABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export class RaceDetector {
  private readonly analyzers: Analyzer[];

  constructor(config?: Partial<RaceDetectorConfig>) {
    this.analyzers = [];

    if (config?.checkSharedState !== false) {
      this.analyzers.push(new SharedStateAnalyzer());
    }

    this.analyzers.push(new ToctouAnalyzer());
    this.analyzers.push(new AsyncPatternsAnalyzer());

    if (config?.checkDatabase !== false) {
      this.analyzers.push(new DatabaseRaceAnalyzer());
    }
  }

  detect(files: string[], projectRoot: string): RaceFinding[] {
    const tsFiles = files.filter(f => {
      const ext = f.slice(f.lastIndexOf('.'));
      return ANALYZABLE_EXTENSIONS.has(ext);
    });

    if (tsFiles.length === 0) return [];

    const compilerHost = ts.createCompilerHost({
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
      jsx: ts.JsxEmit.React,
      strict: false,
      skipLibCheck: true,
      noEmit: true,
    });

    const program = ts.createProgram(tsFiles, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
      jsx: ts.JsxEmit.React,
      strict: false,
      skipLibCheck: true,
      noEmit: true,
      rootDir: projectRoot,
    }, compilerHost);

    const findings: RaceFinding[] = [];

    for (const filePath of tsFiles) {
      const sourceFile = program.getSourceFile(filePath);
      if (!sourceFile) continue;

      for (const analyzer of this.analyzers) {
        findings.push(...analyzer.analyze(sourceFile, filePath));
      }
    }

    return this.deduplicateFindings(findings);
  }

  detectSource(source: string, filePath = 'input.ts'): RaceFinding[] {
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.ES2022,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const findings: RaceFinding[] = [];

    for (const analyzer of this.analyzers) {
      findings.push(...analyzer.analyze(sourceFile, filePath));
    }

    return this.deduplicateFindings(findings);
  }

  private deduplicateFindings(findings: RaceFinding[]): RaceFinding[] {
    const seen = new Set<string>();
    return findings.filter(f => {
      const key = `${f.file}:${f.line}:${f.type}:${f.pattern}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
