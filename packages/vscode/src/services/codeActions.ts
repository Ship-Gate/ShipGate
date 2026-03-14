import * as vscode from 'vscode';

export class ShipGateCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== 'ShipGate') continue;
      const code = typeof diag.code === 'object' ? diag.code.value : diag.code;
      const action = this.getFixForCode(String(code), document, diag);
      if (action) actions.push(action);
    }

    return actions;
  }

  private getFixForCode(code: string, doc: vscode.TextDocument, diag: vscode.Diagnostic): vscode.CodeAction | null {
    const line = doc.lineAt(diag.range.start.line);
    const text = line.text;

    switch (code) {
      case 'SG002': {
        const match = text.match(/(['"])(sk_live_|ghp_|gho_|AKIA)[^'"]*\1/);
        if (match) {
          const action = new vscode.CodeAction('Replace with process.env variable', vscode.CodeActionKind.QuickFix);
          action.edit = new vscode.WorkspaceEdit();
          const envName = match[2].startsWith('sk_') ? 'STRIPE_SECRET_KEY'
            : match[2].startsWith('ghp_') || match[2].startsWith('gho_') ? 'GITHUB_TOKEN'
            : match[2].startsWith('AKIA') ? 'AWS_ACCESS_KEY_ID'
            : 'SECRET_KEY';
          action.edit.replace(doc.uri, new vscode.Range(
            diag.range.start.line, text.indexOf(match[0]),
            diag.range.start.line, text.indexOf(match[0]) + match[0].length
          ), `process.env.${envName}`);
          action.diagnostics = [diag];
          action.isPreferred = true;
          return action;
        }
        break;
      }
      case 'SG003': {
        const action = new vscode.CodeAction('Replace eval() with JSON.parse() or Function()', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(doc.uri, line.range, text.replace(/\beval\s*\(/, 'JSON.parse('));
        action.diagnostics = [diag];
        return action;
      }
      case 'SG005': {
        const action = new vscode.CodeAction('Replace innerHTML with textContent', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(doc.uri, line.range, text.replace(/\.innerHTML\s*=/, '.textContent ='));
        action.diagnostics = [diag];
        action.isPreferred = true;
        return action;
      }
      case 'SG030': {
        const match = text.match(/from\s+['"]([^'"]+)['"]/);
        if (match && !match[1].startsWith('.')) {
          const pkgName = match[1].replace(/\/.*$/, '');
          const action = new vscode.CodeAction(`Install ${pkgName}`, vscode.CodeActionKind.QuickFix);
          action.command = {
            title: `Install ${pkgName}`,
            command: 'workbench.action.terminal.sendSequence',
            arguments: [{ text: `npm install ${pkgName}\n` }],
          };
          action.diagnostics = [diag];
          return action;
        }
        break;
      }
      case 'SG050': {
        const action = new vscode.CodeAction('Use process.env.JWT_SECRET', vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        const jwtMatch = text.match(/jwt\.sign\s*\([^,]+,\s*(['"][^'"]+['"])/);
        if (jwtMatch) {
          action.edit.replace(doc.uri, new vscode.Range(
            diag.range.start.line, text.indexOf(jwtMatch[1]),
            diag.range.start.line, text.indexOf(jwtMatch[1]) + jwtMatch[1].length
          ), 'process.env.JWT_SECRET!');
          action.diagnostics = [diag];
          action.isPreferred = true;
          return action;
        }
        break;
      }
      case 'SG031': {
        if (text.includes('fs.exists(')) {
          const action = new vscode.CodeAction('Replace with fs.access()', vscode.CodeActionKind.QuickFix);
          action.edit = new vscode.WorkspaceEdit();
          action.edit.replace(doc.uri, line.range, text.replace('fs.exists(', 'fs.access('));
          action.diagnostics = [diag];
          return action;
        }
        if (text.includes('new Buffer(')) {
          const action = new vscode.CodeAction('Replace with Buffer.from()', vscode.CodeActionKind.QuickFix);
          action.edit = new vscode.WorkspaceEdit();
          action.edit.replace(doc.uri, line.range, text.replace('new Buffer(', 'Buffer.from('));
          action.diagnostics = [diag];
          action.isPreferred = true;
          return action;
        }
        break;
      }
    }

    const suppress = new vscode.CodeAction('Suppress this ShipGate warning', vscode.CodeActionKind.QuickFix);
    suppress.edit = new vscode.WorkspaceEdit();
    const indent = text.match(/^(\s*)/)?.[1] ?? '';
    suppress.edit.insert(doc.uri, new vscode.Position(diag.range.start.line, 0), `${indent}// shipgate-ignore-next-line ${code}\n`);
    suppress.diagnostics = [diag];
    return suppress;
  }
}
