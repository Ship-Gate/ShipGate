/**
 * Code Action Provider for TypeScript/JavaScript
 * Offers "Generate ISL spec from this TypeScript file" when in .ts/.js files
 */

import * as vscode from 'vscode';
import { runCodeToIsl } from '../commands/codeToIsl';

export function registerCodeToIslCodeAction(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  onRefresh: () => void
): void {
  const provider = vscode.languages.registerCodeActionsProvider(
    [
      { language: 'typescript', scheme: 'file' },
      { language: 'javascript', scheme: 'file' },
      { language: 'typescriptreact', scheme: 'file' },
      { language: 'javascriptreact', scheme: 'file' },
    ],
    {
      provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range,
        _context: vscode.CodeActionContext
      ): vscode.CodeAction[] {
        const action = new vscode.CodeAction(
          'Generate ISL spec from this TypeScript file',
          vscode.CodeActionKind.Source
        );
        action.command = {
          command: 'shipgate.codeToIslFromFile',
          title: 'Generate ISL spec from this file',
          arguments: [document.uri.fsPath],
        };
        return [action];
      },
    }
  );

  context.subscriptions.push(provider);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'shipgate.codeToIslFromFile',
      async (filePath?: string) => {
        const targetPath = filePath ?? vscode.window.activeTextEditor?.document.uri.fsPath ?? workspaceRoot;
        const result = await runCodeToIsl(workspaceRoot, targetPath);
        if (result.success) {
          vscode.window.showInformationMessage(
            `Generated ${result.generatedCount ?? 0} ISL spec(s) from code.`
          );
          onRefresh();
        } else {
          vscode.window.showErrorMessage(`Code to ISL failed: ${result.error}`);
        }
      }
    )
  );
}
