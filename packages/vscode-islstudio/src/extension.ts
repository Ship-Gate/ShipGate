/**
 * ISL Studio VS Code Extension
 * 
 * Provides:
 * - Inline diagnostics for violations
 * - Quick fixes from rule explanations
 * - Status bar with SHIP/NO_SHIP
 */

import * as vscode from 'vscode';
import * as path from 'path';

// Diagnostic collection for ISL violations
let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('ISL Studio extension activated');

  // Create diagnostics collection
  diagnosticCollection = vscode.languages.createDiagnosticCollection('islstudio');
  context.subscriptions.push(diagnosticCollection);

  // Create status bar
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'islstudio.runGate';
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('islstudio.runGate', runGate),
    vscode.commands.registerCommand('islstudio.explainRule', explainRule),
    vscode.commands.registerCommand('islstudio.createBaseline', createBaseline)
  );

  // Run on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      const config = vscode.workspace.getConfiguration('islstudio');
      if (config.get('enable') && config.get('runOnSave')) {
        analyzeDocument(document);
      }
    })
  );

  // Run on active editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        const config = vscode.workspace.getConfiguration('islstudio');
        if (config.get('enable')) {
          analyzeDocument(editor.document);
        }
      }
    })
  );

  // Initial analysis
  if (vscode.window.activeTextEditor) {
    analyzeDocument(vscode.window.activeTextEditor.document);
  }

  statusBarItem.show();
}

async function runGate() {
  const terminal = vscode.window.createTerminal('ISL Gate');
  terminal.show();
  terminal.sendText('npx islstudio gate --explain');
}

async function analyzeDocument(document: vscode.TextDocument) {
  // Only analyze JS/TS files
  if (!['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(document.languageId)) {
    return;
  }

  const diagnostics: vscode.Diagnostic[] = [];
  const content = document.getText();
  const fileName = document.fileName;

  // Run simple pattern checks (in a real impl, would call islstudio CLI)
  const violations = checkPatterns(content, fileName);

  for (const v of violations) {
    const range = new vscode.Range(
      new vscode.Position(v.line - 1, 0),
      new vscode.Position(v.line - 1, 1000)
    );

    const severity = v.tier === 'hard_block'
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning;

    const diagnostic = new vscode.Diagnostic(
      range,
      `[${v.ruleId}] ${v.message}`,
      severity
    );
    
    diagnostic.source = 'ISL Studio';
    diagnostic.code = {
      value: v.ruleId,
      target: vscode.Uri.parse(`https://islstudio.dev/rules/${v.ruleId}`),
    };

    diagnostics.push(diagnostic);
  }

  diagnosticCollection.set(document.uri, diagnostics);

  // Update status bar
  const errorCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
  const warnCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;

  if (errorCount > 0) {
    statusBarItem.text = `$(shield) NO_SHIP (${errorCount} errors)`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (warnCount > 0) {
    statusBarItem.text = `$(shield) WARN (${warnCount} warnings)`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.text = `$(shield) SHIP`;
    statusBarItem.backgroundColor = undefined;
  }
}

interface Violation {
  ruleId: string;
  message: string;
  line: number;
  tier: 'hard_block' | 'soft_block' | 'advisory';
}

function checkPatterns(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for suppression
    if (line.includes('islstudio-ignore')) {
      continue;
    }

    // Auth bypass
    if (/skipAuth|noAuth|auth\s*=\s*false/i.test(line)) {
      violations.push({
        ruleId: 'auth/bypass-detected',
        message: 'Auth bypass pattern detected',
        line: lineNum,
        tier: 'hard_block',
      });
    }

    // Hardcoded credentials
    if (/['"`](sk_live_|pk_live_|password|secret)[a-zA-Z0-9]{10,}['"`]/i.test(line)) {
      violations.push({
        ruleId: 'auth/hardcoded-credentials',
        message: 'Potential hardcoded credentials',
        line: lineNum,
        tier: 'hard_block',
      });
    }

    // PII logging
    if (/console\.(log|info|debug|warn|error)\s*\(.*\b(ssn|password|creditCard|email)\b/i.test(line)) {
      violations.push({
        ruleId: 'pii/logged-sensitive-data',
        message: 'Sensitive data may be logged',
        line: lineNum,
        tier: 'hard_block',
      });
    }

    // console.log in production
    if (/console\.log\s*\(/.test(line) && !filePath.includes('test') && !filePath.includes('spec')) {
      violations.push({
        ruleId: 'pii/console-in-production',
        message: 'console.log should be removed in production',
        line: lineNum,
        tier: 'soft_block',
      });
    }
  }

  return violations;
}

async function explainRule() {
  const ruleId = await vscode.window.showInputBox({
    prompt: 'Enter rule ID',
    placeHolder: 'auth/bypass-detected',
  });

  if (ruleId) {
    const terminal = vscode.window.createTerminal('ISL Studio');
    terminal.show();
    terminal.sendText(`npx islstudio rules explain ${ruleId}`);
  }
}

async function createBaseline() {
  const terminal = vscode.window.createTerminal('ISL Studio');
  terminal.show();
  terminal.sendText('npx islstudio baseline create');
}

export function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
