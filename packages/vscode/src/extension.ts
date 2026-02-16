import * as vscode from 'vscode';
import { ShipGateSidebarProvider } from './sidebar-provider';
import { ShipGateDiagnostics } from './diagnostics';
import { ShipGateCodeLens } from './codelens';
import { ShipGateStatusBar } from './statusbar';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let sidebarProvider: ShipGateSidebarProvider;
let diagnostics: ShipGateDiagnostics;
let statusBar: ShipGateStatusBar;
let codeLens: ShipGateCodeLens;
let extensionContext: vscode.ExtensionContext;

function getCliCommand(): string {
  const extensionPath = extensionContext.extensionUri.fsPath;
  const cliPath = extensionPath.replace(/packages[\/\\]vscode/, 'packages/cli/dist/cli.cjs');
  
  // Check if CLI exists at the expected path
  const fs = require('fs');
  if (fs.existsSync(cliPath)) {
    return `node "${cliPath}"`;
  }
  
  // Fallback to npx
  console.warn(`ShipGate CLI not found at ${cliPath}, falling back to npx`);
  return 'npx shipgate';
}

export function activate(context: vscode.ExtensionContext) {
  console.log('ShipGate extension activating...');
  extensionContext = context;

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

async function runVerification(scope: 'full' | 'file', uri?: vscode.Uri) {
  statusBar.setScanning();
  sidebarProvider.sendMessage({ type: 'scanning', scope });

  try {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) {
      throw new Error('No workspace folder found');
    }

    const target = scope === 'file' && uri ? uri.fsPath : '.';
    
    // Execute shipgate CLI (handle exit codes properly)
    const { stdout, stderr } = await execAsync(`${getCliCommand()} verify ${target} --json`, { 
      cwd, 
      timeout: 60000 
    }).catch((err) => {
      // CLI returns exit code 1 for NO_SHIP, but still outputs JSON
      if (err.stdout) {
        return { stdout: err.stdout, stderr: err.stderr || '' };
      }
      throw err;
    });

    const data = JSON.parse(stdout);
    sidebarProvider.sendMessage({ type: 'results', data });
    
    if (data.findings) {
      diagnostics.update(data.findings, cwd);
      codeLens.updateFindings(data.findings);
    }
    
    statusBar.setVerdict(data.verdict || 'SHIP', data.score || 100);
  } catch (err: any) {
    const errorMsg = err.message || 'Verification failed';
    sidebarProvider.sendMessage({ type: 'error', message: errorMsg });
    statusBar.setError();
    vscode.window.showErrorMessage(`ShipGate: ${errorMsg}`);
  }
}

async function runInit() {
  const terminal = vscode.window.createTerminal('ShipGate Init');
  terminal.show();
  terminal.sendText(`${getCliCommand()} init`);
}

async function runShipCheck() {
  statusBar.setScanning();
  sidebarProvider.sendMessage({ type: 'scanning', scope: 'full' });

  try {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) throw new Error('No workspace folder found');

    const { stdout } = await execAsync(`${getCliCommand()} ship --ci --json`, { cwd, timeout: 120000 })
      .catch((err) => {
        // CLI returns exit code 1 for NO_SHIP, but still outputs JSON
        if (err.stdout) {
          return { stdout: err.stdout, stderr: err.stderr || '' };
        }
        throw err;
      });
    const data = JSON.parse(stdout);
    
    sidebarProvider.sendMessage({ type: 'results', data });
    statusBar.setVerdict(data.verdict || 'SHIP', data.score || 100);
    
    vscode.window.showInformationMessage(`ShipGate: ${data.verdict} (${data.score}/100)`);
  } catch (err: any) {
    sidebarProvider.sendMessage({ type: 'error', message: err.message });
    statusBar.setError();
  }
}

async function runAutofix(scope: 'file' | 'all') {
  const terminal = vscode.window.createTerminal('ShipGate Heal');
  terminal.show();
  
  if (scope === 'file') {
    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activeFile) {
      terminal.sendText(`${getCliCommand()} heal "${activeFile}"`);
    }
  } else {
    terminal.sendText(`${getCliCommand()} heal .`);
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
  const terminal = vscode.window.createTerminal('ShipGate Export');
  terminal.show();
  terminal.sendText(`${getCliCommand()} export --format pdf`);
}

async function showFindings() {
  vscode.commands.executeCommand('workbench.actions.view.problems');
}

async function clearFindings() {
  diagnostics.update([], '');
  vscode.window.showInformationMessage('ShipGate findings cleared');
}

export function deactivate() {
  console.log('ShipGate extension deactivated');
}
