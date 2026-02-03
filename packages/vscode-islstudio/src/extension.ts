/**
 * ISL Studio VS Code Extension
 * 
 * Control surface for ISL:
 * - Set intent blocks
 * - Run gate changed-only
 * - Run heal until ship
 * - View violations and proof bundles
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ISLStudioTreeProvider } from './sidebar';
import { HealUIPanel } from './heal-ui';
import { runGate, GateResult, Violation } from './gate-runner';
import { findAllIntentBlocks, IntentBlock } from './intent-manager';
import { findProofBundles, viewProofBundle, ProofBundle } from './proof-bundle-manager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Global state
let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let treeProvider: ISLStudioTreeProvider;
let currentGateResult: GateResult | null = null;
let extensionContext: vscode.ExtensionContext;

// Store current results for explain
let currentViolations: Map<string, Violation[]> = new Map();

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

  // Create sidebar tree view
  treeProvider = new ISLStudioTreeProvider();
  context.subscriptions.push(
    vscode.window.createTreeView('islstudioSidebar', {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
    })
  );

  // Refresh sidebar periodically
  const refreshInterval = setInterval(async () => {
    await refreshSidebar();
  }, 30000); // Every 30 seconds
  context.subscriptions.push({ dispose: () => clearInterval(refreshInterval) });

  // Register all commands
  context.subscriptions.push(
    vscode.commands.registerCommand('islstudio.runGate', () => handleRunGate(false)),
    vscode.commands.registerCommand('islstudio.runGateChangedOnly', () => handleRunGate(true)),
    vscode.commands.registerCommand('islstudio.healUntilShip', () => handleHealUntilShip()),
    vscode.commands.registerCommand('islstudio.setIntentBlocks', () => handleSetIntentBlocks()),
    vscode.commands.registerCommand('islstudio.explainRule', explainRule),
    vscode.commands.registerCommand('islstudio.createBaseline', createBaseline),
    vscode.commands.registerCommand('islstudio.useBaseline', useBaseline),
    vscode.commands.registerCommand('islstudio.init', initProject),
    vscode.commands.registerCommand('islstudio.showOutput', () => outputChannel.show()),
    vscode.commands.registerCommand('islstudio.viewProofBundle', (bundlePath: string) => viewProofBundle(bundlePath)),
    vscode.commands.registerCommand('islstudio.refreshSidebar', () => refreshSidebar())
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

async function handleRunGate(changedOnly: boolean) {
  updateStatusBar('running');
  outputChannel.appendLine(`\n[${new Date().toISOString()}] Running ISL Gate (${changedOnly ? 'changed files only' : 'all files'})...`);

  try {
    const result = await runGate(changedOnly, outputChannel);
    currentGateResult = result;

    outputChannel.appendLine(`Result: ${result.verdict} (${result.score}/100)`);
    outputChannel.appendLine(`Violations: ${result.violations.length}`);

    // Update diagnostics
    updateDiagnostics(result.violations);
    
    // Update status bar
    updateStatusBar(result.verdict, result.score, result.violations.length);

    // Update sidebar
    treeProvider.updateGateResult(result);
    await refreshSidebar();

    // Show notification for NO_SHIP
    if (result.verdict === 'NO_SHIP') {
      const action = await vscode.window.showWarningMessage(
        `ISL Gate: NO_SHIP (${result.score}/100) - ${result.violations.length} violation(s)`,
        'Show Problems',
        'Heal Until Ship',
        'Show Output'
      );
      if (action === 'Show Problems') {
        vscode.commands.executeCommand('workbench.actions.view.problems');
      } else if (action === 'Heal Until Ship') {
        handleHealUntilShip();
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
      const hasErrors = violations.some(v => v.severity === 'critical' || v.severity === 'high');
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
        file: filePath,
        line: lineNum,
        severity: 'critical',
      });
    }

    // Hardcoded credentials
    if (/['"`](sk_live_|pk_live_|password|secret|api_key)[a-zA-Z0-9_]{8,}['"`]/i.test(line)) {
      violations.push({
        ruleId: 'auth/hardcoded-credentials',
        message: 'Potential hardcoded credentials detected',
        file: filePath,
        line: lineNum,
        severity: 'critical',
      });
    }

    // PII logging
    if (/console\.(log|info|debug|warn|error)\s*\([^)]*\b(ssn|password|creditCard|email|phone)\b/i.test(line)) {
      violations.push({
        ruleId: 'pii/logged-sensitive-data',
        message: 'Sensitive data may be logged',
        file: filePath,
        line: lineNum,
        severity: 'critical',
      });
    }

    // console.log in production
    if (/console\.log\s*\(/.test(line) && !filePath.includes('test') && !filePath.includes('spec')) {
      violations.push({
        ruleId: 'pii/console-in-production',
        message: 'console.log should be removed in production code',
        file: filePath,
        line: lineNum,
        severity: 'medium',
      });
    }

    // Missing rate limit on auth
    if (/\.(post|put)\s*\(\s*['"`](\/login|\/auth|\/register)/i.test(line)) {
      // Check if rate limiter is in the file
      if (!/rateLimit|rateLimiter|throttle/i.test(content)) {
        violations.push({
          ruleId: 'rate-limit/auth-endpoint',
          message: 'Auth endpoint may lack rate limiting',
          file: filePath,
          line: lineNum,
          severity: 'high',
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
    const file = v.file || 'unknown';
    if (!byFile.has(file)) {
      byFile.set(file, []);
    }
    byFile.get(file)!.push(v);
  }

  // Create diagnostics per file
  for (const [file, fileViolations] of byFile) {
    try {
      const uri = vscode.Uri.file(file);
      const diagnostics = fileViolations.map(v => createDiagnostic(v));
      diagnosticCollection.set(uri, diagnostics);
      currentViolations.set(file, fileViolations);
    } catch (error) {
      // Skip invalid file paths
      outputChannel.appendLine(`Warning: Could not create diagnostics for ${file}`);
    }
  }
}

function createDiagnostic(v: Violation): vscode.Diagnostic {
  const line = Math.max(0, (v.line || 1) - 1);
  const range = new vscode.Range(line, 0, line, 1000);

  const severity = v.severity === 'critical'
    ? vscode.DiagnosticSeverity.Error
    : v.severity === 'high'
    ? vscode.DiagnosticSeverity.Warning
    : v.severity === 'medium'
    ? vscode.DiagnosticSeverity.Information
    : vscode.DiagnosticSeverity.Hint;

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
// Heal Until Ship
// ============================================================================

async function handleHealUntilShip() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Show heal UI panel
  const panel = HealUIPanel.createOrShow(context.extensionUri);
  
  outputChannel.appendLine('\nStarting heal until ship...');
  outputChannel.show();

  try {
    const cwd = workspaceFolder.uri.fsPath;
    
    // Run heal command via CLI
    const cmd = `npx islstudio@latest heal --max-iterations 8 --verbose`;
    
    outputChannel.appendLine(`Command: ${cmd}`);
    
    // For now, show a message that this requires ISL pipeline integration
    vscode.window.showInformationMessage(
      'Heal Until Ship: This feature requires ISL pipeline integration. Running gate first...'
    );
    
    // Run gate first to show current state
    await handleRunGate(true);
    
    // TODO: Integrate with ISL pipeline healer
    // const healer = new SemanticHealer(...);
    // const result = await healer.heal();
    
  } catch (error: any) {
    outputChannel.appendLine(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Heal failed: ${error.message}`);
  }
}

// ============================================================================
// Set Intent Blocks
// ============================================================================

async function handleSetIntentBlocks() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  outputChannel.appendLine('\nFinding intent blocks...');
  
  try {
    const blocks = await findAllIntentBlocks();
    treeProvider.updateIntentBlocks(blocks);
    await refreshSidebar();
    
    vscode.window.showInformationMessage(
      `Found ${blocks.length} intent blocks`
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to find intent blocks: ${error.message}`);
  }
}

// ============================================================================
// Refresh Sidebar
// ============================================================================

async function refreshSidebar() {
  try {
    // Refresh intent blocks
    const blocks = await findAllIntentBlocks();
    treeProvider.updateIntentBlocks(blocks);
    
    // Refresh proof bundles
    const bundles = await findProofBundles();
    treeProvider.updateProofBundles(bundles);
    
    // Refresh gate result if available
    if (currentGateResult) {
      treeProvider.updateGateResult(currentGateResult);
    }
    
    treeProvider.refresh();
  } catch (error) {
    // Silently fail - sidebar refresh is not critical
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

      // Heal action
      const healAction = new vscode.CodeAction(
        `ISL: Heal Until Ship`,
        vscode.CodeActionKind.QuickFix
      );
      healAction.command = {
        command: 'islstudio.healUntilShip',
        title: 'Heal Until Ship',
      };
      actions.push(healAction);

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
