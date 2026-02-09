/**
 * ShipGate CodeLens Provider
 *
 * Shows inline action buttons above `behavior` and `entity` declarations:
 *   ▶ Verify  |  Generate Tests  |  Coverage
 */

import * as vscode from 'vscode';

const BEHAVIOR_RE = /^\s*(behavior)\s+([A-Z][a-zA-Z0-9_]*)\s*\{?/;
const ENTITY_RE = /^\s*(entity)\s+([A-Z][a-zA-Z0-9_]*)\s*\{?/;

export class ISLCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  /**
   * Force a refresh of CodeLens items (e.g. after verify completes).
   */
  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (document.languageId !== 'isl') {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const behaviorMatch = BEHAVIOR_RE.exec(line.text);
      const entityMatch = ENTITY_RE.exec(line.text);
      const match = behaviorMatch ?? entityMatch;

      if (!match) continue;

      const kind = match[1]; // "behavior" or "entity"
      const name = match[2];
      const range = new vscode.Range(i, 0, i, line.text.length);

      // Verify lens
      lenses.push(
        new vscode.CodeLens(range, {
          title: '\u25B6 Verify',
          tooltip: `Verify ${kind} ${name}`,
          command: 'shipgate.verify',
          arguments: [],
        })
      );

      // Generate Tests lens (only for behaviors)
      if (kind === 'behavior') {
        lenses.push(
          new vscode.CodeLens(range, {
            title: '\uD83D\uDD0D Generate Tests',
            tooltip: `Generate test stubs for ${name}`,
            command: 'shipgate.generateSpec',
            arguments: [],
          })
        );
      }

      // Coverage lens
      lenses.push(
        new vscode.CodeLens(range, {
          title: '\uD83D\uDCCA Coverage',
          tooltip: `Show coverage for ${kind} ${name}`,
          command: 'shipgate.coverage',
          arguments: [],
        })
      );
    }

    return lenses;
  }
}

/**
 * Register the CodeLens provider for ISL files.
 */
export function registerCodeLensProvider(
  context: vscode.ExtensionContext
): ISLCodeLensProvider {
  const provider = new ISLCodeLensProvider();

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: 'isl', scheme: 'file' },
      provider
    )
  );

  return provider;
}
