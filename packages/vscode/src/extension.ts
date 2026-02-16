import * as vscode from 'vscode';
import { ShipGateSidebarProvider } from './sidebar-provider';
import { ShipGateDiagnostics } from './diagnostics';
import { ShipGateCodeLens } from './codelens';
import { ShipGateStatusBar } from './statusbar';
import { runShipgateScan, resolveShipgateExecutable } from './cli/shipgateRunner';
import type { ScanResult, FileFinding } from './model/types';

let sidebarProvider: ShipGateSidebarProvider;
let diagnostics: ShipGateDiagnostics;
let statusBar: ShipGateStatusBar;
let codeLens: ShipGateCodeLens;

export function activate(context: vscode.ExtensionContext) {
  console.log('ShipGate extension activating...');

  // Sidebar
  sidebarProvider = new ShipGateSidebarProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('shipgate.sidebar', sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Diagnostics
  diagnostics = new ShipGateDiagnostics();
  context.subscriptions.push(diagnostics);

  // CodeLens
  codeLens = new ShipGateCodeLens();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { language: 'typescript' },
        { language: 'typescriptreact' },
        { language: 'javascript' },
        { language: 'javascriptreact' },
        { language: 'python' }
      ],
      codeLens
    )
  );

  // Status bar
  statusBar = new ShipGateStatusBar();
  context.subscriptions.push(statusBar);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.verify', () => runVerification('full')),
    vscode.commands.registerCommand('shipgate.verifyFile', () => runVerification('file')),
    vscode.commands.registerCommand('shipgate.init', () => runInit()),
    vscode.commands.registerCommand('shipgate.ship', () => runShipCheck()),
    vscode.commands.registerCommand('shipgate.autofix', () => runAutofix('file')),
    vscode.commands.registerCommand('shipgate.autofixAll', () => runAutofix('all')),
    vscode.commands.registerCommand('shipgate.toggleWatch', () => toggleWatch()),
    vscode.commands.registerCommand('shipgate.viewProofBundle', () => viewProofBundle()),
    vscode.commands.registerCommand('shipgate.exportReport', () => exportReport()),
    vscode.commands.registerCommand('shipgate.openDashboard', () => {
      vscode.env.openExternal(vscode.Uri.parse('http://localhost:3000'));
    }),
    vscode.commands.registerCommand('shipgate.showFindings', () => showFindings()),
    vscode.commands.registerCommand('shipgate.clearFindings', () => clearFindings()),
  );

  // Scan on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (vscode.workspace.getConfiguration('shipgate').get('scanOnSave')) {
        runVerification('file', doc.uri);
      }
    })
  );

  console.log('ShipGate extension activated');
}

function fileFindingsToFindings(files: FileFinding[], cwd: string) {
  const findings: Array<{ file: string; line: number; message: string; severity: string; engine: string; fixable: boolean }> = [];
  for (const f of files) {
    if (f.status === 'PASS') continue;
    for (const blocker of f.blockers) {
      findings.push({
        file: f.file,
        line: 1,
        message: blocker,
        severity: f.status === 'FAIL' ? 'error' : 'warning',
        engine: f.mode || 'shipgate',
        fixable: false,
      });
    }
    for (const error of f.errors) {
      findings.push({
        file: f.file,
        line: 1,
        message: error,
        severity: 'error',
        engine: f.mode || 'shipgate',
        fixable: false,
      });
    }
  }
  return findings;
}

async function runVerification(scope: 'full' | 'file', uri?: vscode.Uri) {
  statusBar.setScanning();
  sidebarProvider.sendMessage({ type: 'scanning', scope });

  try {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) {
      throw new Error('No workspace folder found');
    }

    const config = vscode.workspace.getConfiguration('shipgate');
    const customPath = config.get<string>('scan.executablePath');

    const output = await runShipgateScan({
      workspaceRoot: cwd,
      executablePath: customPath,
    });

    if (!output.success || !output.result) {
      throw new Error(output.error || 'Verification failed');
    }

    const scanResult = output.result;
    const { result } = scanResult;

    // Send results to sidebar
    sidebarProvider.sendMessage({ type: 'results', data: result });

    // Update diagnostics and codelens with findings
    const findings = fileFindingsToFindings(result.files, cwd);
    diagnostics.update(findings, cwd);
    codeLens.updateFindings(findings);

    // Update status bar
    statusBar.setVerdict(result.verdict, result.score);

    // Fire-and-forget: POST result to dashboard API
    postToDashboard(scanResult, cwd);
  } catch (err: any) {
    const errorMsg = err.message || 'Verification failed';
    sidebarProvider.sendMessage({ type: 'error', message: errorMsg });
    statusBar.setError();
    vscode.window.showErrorMessage(`ShipGate: ${errorMsg}`);
  }
}

async function runInit() {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  const config = vscode.workspace.getConfiguration('shipgate');
  const customPath = config.get<string>('scan.executablePath');
  const { executable } = await resolveShipgateExecutable(cwd, customPath);

  const terminal = vscode.window.createTerminal('ShipGate Init');
  terminal.show();
  // Use the resolved executable for init
  if (executable === 'node') {
    // For node-based CLI, we need to find the base CLI path
    terminal.sendText(`node -e "require('${cwd}/packages/cli/dist/cli.cjs')" init`);
  } else if (executable === 'pnpm') {
    terminal.sendText('pnpm exec isl init');
  } else {
    terminal.sendText(`${executable} init`);
  }
}

async function runShipCheck() {
  statusBar.setScanning();
  sidebarProvider.sendMessage({ type: 'scanning', scope: 'full' });

  try {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) throw new Error('No workspace folder found');

    const config = vscode.workspace.getConfiguration('shipgate');
    const customPath = config.get<string>('scan.executablePath');

    const output = await runShipgateScan({
      workspaceRoot: cwd,
      executablePath: customPath,
    });

    if (!output.success || !output.result) {
      throw new Error(output.error || 'Ship check failed');
    }

    const { result } = output.result;

    sidebarProvider.sendMessage({ type: 'results', data: result });
    statusBar.setVerdict(result.verdict, result.score);

    vscode.window.showInformationMessage(`ShipGate: ${result.verdict} (${result.score}/100)`);

    // Fire-and-forget: POST result to dashboard API
    postToDashboard(output.result, cwd);
  } catch (err: any) {
    sidebarProvider.sendMessage({ type: 'error', message: err.message });
    statusBar.setError();
  }
}

async function runAutofix(scope: 'file' | 'all') {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  const config = vscode.workspace.getConfiguration('shipgate');
  const customPath = config.get<string>('scan.executablePath');
  const { executable } = await resolveShipgateExecutable(cwd, customPath);

  const terminal = vscode.window.createTerminal('ShipGate Fix');
  terminal.show();

  if (scope === 'file') {
    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activeFile) {
      if (executable === 'pnpm') {
        terminal.sendText(`pnpm exec isl fix ${activeFile}`);
      } else if (executable === 'npx') {
        terminal.sendText(`npx --yes shipgate fix ${activeFile}`);
      } else {
        terminal.sendText(`${executable} fix ${activeFile}`);
      }
    }
  } else {
    if (executable === 'pnpm') {
      terminal.sendText('pnpm exec isl fix --all');
    } else if (executable === 'npx') {
      terminal.sendText('npx --yes shipgate fix --all');
    } else {
      terminal.sendText(`${executable} fix --all`);
    }
  }
}

async function toggleWatch() {
  const config = vscode.workspace.getConfiguration('shipgate');
  const current = config.get('watchMode');
  await config.update('watchMode', !current, vscode.ConfigurationTarget.Workspace);
  vscode.window.showInformationMessage(`ShipGate watch mode: ${!current ? 'enabled' : 'disabled'}`);
}

async function viewProofBundle() {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  const bundlePath = vscode.Uri.file(`${cwd}/.shipgate/proof-bundle.json`);
  try {
    const doc = await vscode.workspace.openTextDocument(bundlePath);
    await vscode.window.showTextDocument(doc);
  } catch {
    vscode.window.showWarningMessage('No proof bundle found');
  }
}

async function exportReport() {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  const config = vscode.workspace.getConfiguration('shipgate');
  const customPath = config.get<string>('scan.executablePath');
  const { executable } = await resolveShipgateExecutable(cwd, customPath);

  const terminal = vscode.window.createTerminal('ShipGate Export');
  terminal.show();

  if (executable === 'pnpm') {
    terminal.sendText('pnpm exec isl export --format pdf');
  } else if (executable === 'npx') {
    terminal.sendText('npx --yes shipgate export --format pdf');
  } else {
    terminal.sendText(`${executable} export --format pdf`);
  }
}

async function showFindings() {
  vscode.commands.executeCommand('workbench.actions.view.problems');
}

async function clearFindings() {
  diagnostics.update([], '');
  vscode.window.showInformationMessage('ShipGate findings cleared');
}

/** Fire-and-forget POST of scan results to the dashboard API. */
function postToDashboard(scanResult: ScanResult, cwd: string): void {
  const config = vscode.workspace.getConfiguration('shipgate');
  const dashboardUrl = config.get<string>('dashboardApiUrl', 'http://localhost:3700');
  const { result } = scanResult;

  const body = JSON.stringify({
    repo: cwd.split(/[\\/]/).pop() || 'unknown',
    branch: 'main',
    commit: 'local',
    verdict: result.verdict,
    score: result.score,
    coverage: {
      specced: result.coverage.specced,
      total: result.coverage.total,
      percentage: result.coverage.total > 0
        ? Math.round((result.coverage.specced / result.coverage.total) * 100)
        : 0,
    },
    files: result.files.map(f => ({
      path: f.file,
      verdict: f.status.toLowerCase() as 'pass' | 'warn' | 'fail',
      method: (f.mode === 'isl' ? 'isl' : 'specless') as 'isl' | 'specless',
      score: f.score,
      violations: [...f.blockers, ...f.errors],
    })),
    duration: result.duration,
    triggeredBy: 'vscode' as const,
  });

  fetch(`${dashboardUrl}/api/v1/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {
    // Silently ignore dashboard reporting failures
  });
}

export function deactivate() {
  console.log('ShipGate extension deactivated');
}
