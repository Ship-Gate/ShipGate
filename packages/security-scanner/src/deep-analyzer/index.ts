import ts from 'typescript';
import type { SecurityFinding } from '../verification/types.js';
import { resolveTypesAtSinks } from './type-resolver.js';
import { foldConstants } from './constant-folder.js';
import { buildCallGraph, findTaintedPaths } from './call-graph.js';
import { resolveComputedSinks } from './sink-resolver.js';

export type { CallGraph, CallGraphNode } from './call-graph.js';
export type { FoldedConstant } from './constant-folder.js';
export type { ResolvedSink } from './type-resolver.js';

export function deepAnalyze(
  files: string[],
  projectRoot: string,
): SecurityFinding[] {
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
    allowJs: true,
    jsx: ts.JsxEmit.ReactJSX,
  });

  const fileSet = new Set(absolutePaths);
  const projectSources: ts.SourceFile[] = [];

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    if (!fileSet.has(sf.fileName)) continue;
    projectSources.push(sf);
  }

  if (projectSources.length === 0) return [];

  const findings: SecurityFinding[] = [];

  findings.push(...resolveTypesAtSinks(program, projectSources));
  findings.push(...foldConstants(program, projectSources));

  const callGraph = buildCallGraph(program, projectSources);
  findings.push(...findTaintedPaths(callGraph, program, projectSources));

  findings.push(...resolveComputedSinks(program, projectSources));

  findings.sort((a, b) => {
    const severityOrder: Record<string, number> = {
      critical: 0, high: 1, medium: 2, low: 3,
    };
    return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
  });

  return findings;
}
