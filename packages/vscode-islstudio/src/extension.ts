/**
 * ISL Studio VS Code Extension
 * 
 * Non-negotiable UX:
 * - Status pill: SHIP / NO_SHIP + score
 * - Problems panel diagnostics + click → "Explain + Fix"
 * - "Run Gate on Changed Files" command (fast)
 * - "Use Baseline / Create Baseline" command
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Diagnostic collection for ISL violations
let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

// Store current results for explain
let currentViolations: Map<string, Violation[]> = new Map();

interface Violation {
  ruleId: string;
  message: string;
  filePath: string;
  line: number;
  tier: 'hard_block' | 'soft_block' | 'warn';
  suggestion?: string;
}

interface GateResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  violations: Violation[];
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('ISL Studio');
  outputChannel.appendLine('ISL Studio extension activated');

  // Create diagnostics collection
  diagnosticCollection = vscode.languages.createDiagnosticCollection('islstudio');
  context.subscriptions.push(diagnosticCollection);

  // Create status bar - prominent position
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1000 // High priority = leftmost
  );
  statusBarItem.command = 'islstudio.runGate';
  statusBarItem.tooltip = 'Click to run ISL Gate';
  context.subscriptions.push(statusBarItem);

  // Register all commands
  context.subscriptions.push(
    vscode.commands.registerCommand('islstudio.runGate', () => runGate(false)),
    vscode.commands.registerCommand('islstudio.runGateChangedOnly', () => runGate(true)),
    vscode.commands.registerCommand('islstudio.explainRule', explainRule),
    vscode.commands.registerCommand('islstudio.createBaseline', createBaseline),
    vscode.commands.registerCommand('islstudio.useBaseline', useBaseline),
    vscode.commands.registerCommand('islstudio.init', initProject),
    vscode.commands.registerCommand('islstudio.showOutput', () => outputChannel.show())
  );

  // Register code action provider for quick fixes
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
      new ISLCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    )
  );

  // Run on save if enabled
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      const config = vscode.workspace.getConfiguration('islstudio');
      if (config.get('enable') && config.get('runOnSave')) {
        runGateOnFile(document.uri.fsPath);
      }
    })
  );

  // Initial status
  updateStatusBar('ready');
  statusBarItem.show();

  // Run initial check
  const config = vscode.workspace.getConfiguration('islstudio');
  if (config.get('enable') && config.get('runOnOpen')) {
    setTimeout(() => runGate(true), 2000);
  }
}

// ============================================================================
// Gate Execution
// ============================================================================

async function runGate(changedOnly: boolean) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  updateStatusBar('running');
  outputChannel.appendLine(`\n[${new Date().toISOString()}] Running ISL Gate...`);

  try {
    const cwd = workspaceFolder.uri.fsPath;
    const changedFlag = changedOnly ? '--changed-only' : '';
    const cmd = `npx islstudio@0.1.2 gate --ci --output json ${changedFlag}`;
    
    outputChannel.appendLine(`Command: ${cmd}`);
    
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 60000 });
    
    if (stderr) {
      outputChannel.appendLine(`stderr: ${stderr}`);
    }

    // Parse result
    let result: GateResult;
    try {
      result = JSON.parse(stdout);
    } catch {
      outputChannel.appendLine(`Failed to parse: ${stdout}`);
      updateStatusBar('error');
      return;
    }

    outputChannel.appendLine(`Result: ${result.verdict} (${result.score}/100)`);
    outputChannel.appendLine(`Violations: ${result.violations.length}`);

    // Update diagnostics
    updateDiagnostics(result.violations);
    
    // Update status bar
    updateStatusBar(result.verdict, result.score, result.violations.length);

    // Show notification for NO_SHIP
    if (result.verdict === 'NO_SHIP') {
      const action = await vscode.window.showWarningMessage(
        `ISL Gate: NO_SHIP (${result.score}/100) - ${result.violations.length} violation(s)`,
        'Show Problems',
        'Show Output'
      );
      if (action === 'Show Problems') {
        vscode.commands.executeCommand('workbench.actions.view.problems');
      } else if (action === 'Show Output') {
        outputChannel.show();
      }
    } else {
      vscode.window.showInformationMessage(
        `ISL Gate: SHIP ✓ (${result.score}/100)`
      );
    }

  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    updateStatusBar('error');
    vscode.window.showErrorMessage(`ISL Gate failed: ${error.message}`);
  }
}

async function runGateOnFile(filePath: string) {
  // Quick check on single file
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  try {
    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    const text = Buffer.from(content).toString('utf-8');
    
    // Quick pattern check (faster than CLI for single file)
    const violations = quickCheck(text, filePath);
    
    // Update diagnostics for this file only
    const uri = vscode.Uri.file(filePath);
    const diagnostics = violations.map(v => createDiagnostic(v));
    diagnosticCollection.set(uri, diagnostics);
    
    // Store for explain
    currentViolations.set(filePath, violations);
    
    // Update status if violations found
    if (violations.length > 0) {
      const hasErrors = violations.some(v => v.tier === 'hard_block');
      updateStatusBar(hasErrors ? 'NO_SHIP' : 'WARN', undefined, violations.length);
    }
    
  } catch (error) {
    // Ignore errors on quick check
  }
}

// ============================================================================
// Quick Check (fast, in-process)
// ============================================================================

function quickCheck(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip suppressed lines
    if (line.includes('islstudio-ignore')) continue;

    // Auth bypass
    if (/skipAuth|noAuth|auth\s*=\s*false/i.test(line)) {
      violations.push({
        ruleId: 'auth/bypass-detected',
        message: 'Auth bypass pattern detected - authentication may be disabled',
        filePath,
        line: lineNum,
        tier: 'hard_block',
        suggestion: 'Remove auth bypass code. Use test tokens for testing instead.',
      });
    }

    // Hardcoded credentials
    if (/['"`](sk_live_|pk_live_|password|secret|api_key)[a-zA-Z0-9_]{8,}['"`]/i.test(line)) {
      violations.push({
        ruleId: 'auth/hardcoded-credentials',
        message: 'Potential hardcoded credentials detected',
        filePath,
        line: lineNum,
        tier: 'hard_block',
        suggestion: 'Move secrets to environment variables (process.env.SECRET)',
      });
    }

    // PII logging
    if (/console\.(log|info|debug|warn|error)\s*\([^)]*\b(ssn|password|creditCard|email|phone)\b/i.test(line)) {
      violations.push({
        ruleId: 'pii/logged-sensitive-data',
        message: 'Sensitive data may be logged',
        filePath,
        line: lineNum,
        tier: 'hard_block',
        suggestion: 'Remove PII from logs or mask sensitive fields',
      });
    }

    // console.log in production
    if (/console\.log\s*\(/.test(line) && !filePath.includes('test') && !filePath.includes('spec')) {
      violations.push({
        ruleId: 'pii/console-in-production',
        message: 'console.log should be removed in production code',
        filePath,
        line: lineNum,
        tier: 'soft_block',
        suggestion: 'Use a proper logger or remove before production',
      });
    }

    // Missing rate limit on auth
    if (/\.(post|put)\s*\(\s*['"`](\/login|\/auth|\/register)/i.test(line)) {
      // Check if rate limiter is in the file
      if (!/rateLimit|rateLimiter|throttle/i.test(content)) {
        violations.push({
          ruleId: 'rate-limit/auth-endpoint',
          message: 'Auth endpoint may lack rate limiting',
          filePath,
          line: lineNum,
          tier: 'soft_block',
          suggestion: 'Add rate limiting middleware (e.g., express-rate-limit)',
        });
      }
    }
  }

  return violations;
}

// ============================================================================
// Diagnostics
// ============================================================================

function updateDiagnostics(violations: Violation[]) {
  diagnosticCollection.clear();
  currentViolations.clear();

  // Group by file
  const byFile = new Map<string, Violation[]>();
  for (const v of violations) {
    const file = v.filePath || 'unknown';
    if (!byFile.has(file)) {
      byFile.set(file, []);
    }
    byFile.get(file)!.push(v);
  }

  // Create diagnostics per file
  for (const [file, fileViolations] of byFile) {
    const uri = vscode.Uri.file(file);
    const diagnostics = fileViolations.map(v => createDiagnostic(v));
    diagnosticCollection.set(uri, diagnostics);
    currentViolations.set(file, fileViolations);
  }
}

function createDiagnostic(v: Violation): vscode.Diagnostic {
  const line = Math.max(0, (v.line || 1) - 1);
  const range = new vscode.Range(line, 0, line, 1000);

  const severity = v.tier === 'hard_block'
    ? vscode.DiagnosticSeverity.Error
    : v.tier === 'soft_block'
    ? vscode.DiagnosticSeverity.Warning
    : vscode.DiagnosticSeverity.Information;

  const diagnostic = new vscode.Diagnostic(range, v.message, severity);
  diagnostic.source = 'ISL Studio';
  diagnostic.code = {
    value: v.ruleId,
    target: vscode.Uri.parse(`command:islstudio.explainRule?${encodeURIComponent(JSON.stringify(v.ruleId))}`),
  };

  return diagnostic;
}

// ============================================================================
// Status Bar
// ============================================================================

function updateStatusBar(
  state: 'ready' | 'running' | 'error' | 'SHIP' | 'NO_SHIP' | 'WARN',
  score?: number,
  violations?: number
) {
  switch (state) {
    case 'ready':
      statusBarItem.text = '$(shield) ISL Studio';
      statusBarItem.backgroundColor = undefined;
      break;
    case 'running':
      statusBarItem.text = '$(sync~spin) ISL Gate...';
      statusBarItem.backgroundColor = undefined;
      break;
    case 'error':
      statusBarItem.text = '$(error) ISL Error';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      break;
    case 'SHIP':
      statusBarItem.text = `$(pass) SHIP ${score !== undefined ? `${score}/100` : ''}`;
      statusBarItem.backgroundColor = undefined;
      break;
    case 'NO_SHIP':
      statusBarItem.text = `$(error) NO_SHIP ${score !== undefined ? `${score}/100` : ''} (${violations || 0})`;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      break;
    case 'WARN':
      statusBarItem.text = `$(warning) WARN (${violations || 0})`;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      break;
  }
}

// ============================================================================
// Commands
// ============================================================================

async function explainRule(ruleId?: string) {
  if (!ruleId) {
    ruleId = await vscode.window.showInputBox({
      prompt: 'Enter rule ID to explain',
      placeHolder: 'auth/bypass-detected',
    });
  }

  if (!ruleId) return;

  outputChannel.appendLine(`\nExplaining rule: ${ruleId}`);
  outputChannel.show();

  try {
    const { stdout } = await execAsync(`npx islstudio@0.1.2 rules explain ${ruleId}`);
    
    // Show in a webview panel
    const panel = vscode.window.createWebviewPanel(
      'islstudioExplain',
      `ISL: ${ruleId}`,
      vscode.ViewColumn.Beside,
      {}
    );

    panel.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          pre { background: var(--vscode-editor-background); padding: 10px; border-radius: 4px; }
          h1 { color: var(--vscode-editor-foreground); }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(stdout)}</pre>
      </body>
      </html>
    `;

  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to explain rule: ${error.message}`);
  }
}

async function createBaseline() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    'Create baseline from current violations? This will allow them to pass until fixed.',
    'Create Baseline',
    'Cancel'
  );

  if (confirm !== 'Create Baseline') return;

  outputChannel.appendLine('\nCreating baseline...');
  outputChannel.show();

  try {
    const cwd = workspaceFolder.uri.fsPath;
    const { stdout } = await execAsync('npx islstudio@0.1.2 baseline create', { cwd });
    
    outputChannel.appendLine(stdout);
    vscode.window.showInformationMessage(
      'Baseline created! Commit .islstudio/baseline.json to your repo.'
    );

  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to create baseline: ${error.message}`);
  }
}

async function useBaseline() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  try {
    const cwd = workspaceFolder.uri.fsPath;
    const { stdout } = await execAsync('npx islstudio@0.1.2 baseline show', { cwd });
    
    outputChannel.appendLine('\nBaseline status:');
    outputChannel.appendLine(stdout);
    outputChannel.show();

  } catch (error: any) {
    const action = await vscode.window.showWarningMessage(
      'No baseline found. Create one?',
      'Create Baseline',
      'Cancel'
    );
    if (action === 'Create Baseline') {
      createBaseline();
    }
  }
}

async function initProject() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  outputChannel.appendLine('\nInitializing ISL Studio...');
  outputChannel.show();

  try {
    const cwd = workspaceFolder.uri.fsPath;
    const { stdout } = await execAsync('npx islstudio@0.1.2 init -y', { cwd });
    
    outputChannel.appendLine(stdout);
    vscode.window.showInformationMessage(
      'ISL Studio initialized! Commit .islstudio/ and .github/workflows/'
    );

  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to init: ${error.message}`);
  }
}

// ============================================================================
// Code Actions (Quick Fixes)
// ============================================================================

class ISLCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'ISL Studio') continue;

      const ruleId = typeof diagnostic.code === 'object' 
        ? diagnostic.code.value 
        : diagnostic.code;

      // Explain action
      const explainAction = new vscode.CodeAction(
        `ISL: Explain ${ruleId}`,
        vscode.CodeActionKind.QuickFix
      );
      explainAction.command = {
        command: 'islstudio.explainRule',
        title: 'Explain Rule',
        arguments: [ruleId],
      };
      actions.push(explainAction);

      // Suppress action
      const suppressAction = new vscode.CodeAction(
        `ISL: Suppress ${ruleId}`,
        vscode.CodeActionKind.QuickFix
      );
      suppressAction.edit = new vscode.WorkspaceEdit();
      
      const line = diagnostic.range.start.line;
      const suppressComment = `// islstudio-ignore ${ruleId}: TODO: Add justification\n`;
      suppressAction.edit.insert(
        document.uri,
        new vscode.Position(line, 0),
        suppressComment
      );
      actions.push(suppressAction);
    }

    return actions;
  }
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function deactivate() {
  if (diagnosticCollection) diagnosticCollection.dispose();
  if (statusBarItem) statusBarItem.dispose();
  if (outputChannel) outputChannel.dispose();
}
