import * as vscode from 'vscode';

interface TaintFlow {
  sourceFile: string;
  sourceLine: number;
  sourceVar: string;
  sinkFile: string;
  sinkLine: number;
  sinkType: string;
}

const flows: TaintFlow[] = [];

export class TaintFlowCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const filePath = doc.uri.fsPath;

    for (const flow of flows) {
      if (flow.sourceFile === filePath) {
        const line = Math.max(0, flow.sourceLine - 1);
        if (line < doc.lineCount) {
          lenses.push(new vscode.CodeLens(
            new vscode.Range(line, 0, line, 0),
            {
              title: `$(warning) Taint source: ${flow.sourceVar} \u2192 flows to ${flow.sinkType} (line ${flow.sinkLine})`,
              command: 'revealLine',
              arguments: [{ lineNumber: flow.sinkLine - 1, at: 'center' }],
            }
          ));
        }
      }
      if (flow.sinkFile === filePath) {
        const line = Math.max(0, flow.sinkLine - 1);
        if (line < doc.lineCount) {
          lenses.push(new vscode.CodeLens(
            new vscode.Range(line, 0, line, 0),
            {
              title: `$(error) Taint sink: unsanitized "${flow.sourceVar}" from line ${flow.sourceLine}`,
              command: 'revealLine',
              arguments: [{ lineNumber: flow.sourceLine - 1, at: 'center' }],
            }
          ));
        }
      }
    }

    return lenses;
  }

  updateFlows(newFlows: TaintFlow[]): void {
    flows.length = 0;
    flows.push(...newFlows);
    this._onDidChange.fire();
  }
}

export function extractTaintFlows(content: string, filePath: string): TaintFlow[] {
  const result: TaintFlow[] = [];
  const lines = content.split('\n');
  const sourcePattern = /(?:const|let|var)\s+(\w+)\s*=\s*req\.(?:body|query|params|headers)/;
  const sources: Array<{ var: string; line: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const m = sourcePattern.exec(lines[i]);
    if (m) sources.push({ var: m[1], line: i + 1 });
  }

  const sinks = [
    { pattern: /\.query\s*\(/, type: 'SQL query' },
    { pattern: /exec\s*\(/, type: 'shell command' },
    { pattern: /eval\s*\(/, type: 'eval' },
    { pattern: /\.innerHTML\s*=/, type: 'DOM injection' },
  ];

  for (const src of sources) {
    for (let i = src.line; i < lines.length; i++) {
      if (!lines[i].includes(src.var)) continue;
      for (const sink of sinks) {
        if (sink.pattern.test(lines[i])) {
          result.push({
            sourceFile: filePath, sourceLine: src.line, sourceVar: src.var,
            sinkFile: filePath, sinkLine: i + 1, sinkType: sink.type,
          });
        }
      }
    }
  }

  return result;
}
