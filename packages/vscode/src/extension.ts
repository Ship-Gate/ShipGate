import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ShipGateSidebarProvider } from './sidebar-provider';
import { ShipGateDiagnostics } from './diagnostics';
import { ShipGateCodeLens } from './codelens';
import { ShipGateStatusBar } from './statusbar';
import { runShipgateScan, resolveShipgateExecutable } from './cli/shipgateRunner';
import type { ScanResult, FileFinding } from './model/types';
import { ProofBundlePanelProvider } from './views/proof-bundle-panel';
import { EvidenceDecorationManager } from './views/evidence-decorations';
import { EvidenceCodeLensProvider, ImportDecorationManager } from './views/evidence-codelens';
import { FileDecorationProvider } from './views/file-decorations';
import { registerProofCommands } from './commands/proof-commands';
import { ProService } from './services/proService';

const execAsync = promisify(exec);

let sidebarProvider: ShipGateSidebarProvider;
let diagnostics: ShipGateDiagnostics;
let statusBar: ShipGateStatusBar;
let codeLens: ShipGateCodeLens;
let proofBundlePanel: ProofBundlePanelProvider;
let evidenceDecorations: EvidenceDecorationManager;
let evidenceCodeLens: EvidenceCodeLensProvider;
let importDecorations: ImportDecorationManager;
let fileDecorations: FileDecorationProvider;
let extensionContext: vscode.ExtensionContext;
let proService: ProService;

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

  // Pro service (server-backed license check via PAT)
  proService = new ProService(context.secrets);
  void proService.initialize();

  // Sidebar
  sidebarProvider = new ShipGateSidebarProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('shipgate.sidebar', sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Proof Bundle Panel
  proofBundlePanel = new ProofBundlePanelProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('shipgate.proofBundle', proofBundlePanel, {
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

  // Evidence CodeLens
  evidenceCodeLens = new EvidenceCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { language: 'typescript' },
        { language: 'typescriptreact' },
        { language: 'javascript' },
        { language: 'javascriptreact' },
      ],
      evidenceCodeLens
    )
  );

  // Status bar
  statusBar = new ShipGateStatusBar();
  context.subscriptions.push(statusBar);

  // Evidence Decorations
  evidenceDecorations = new EvidenceDecorationManager(context);
  context.subscriptions.push(evidenceDecorations);

  // Import Decorations
  importDecorations = new ImportDecorationManager();
  context.subscriptions.push(importDecorations);

  // File Decorations
  fileDecorations = new FileDecorationProvider();
  context.subscriptions.push(vscode.window.registerFileDecorationProvider(fileDecorations));

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.verify', () => runVerification('full')),
    vscode.commands.registerCommand('shipgate.verifyFile', () => runVerification('file')),
    vscode.commands.registerCommand('shipgate.init', () => runInit()),
    vscode.commands.registerCommand('shipgate.ship', () => runShipCheck()),
    vscode.commands.registerCommand('shipgate.autofix', async () => {
      if (await requirePro('AI Heal')) runAutofix('file');
    }),
    vscode.commands.registerCommand('shipgate.autofixAll', async () => {
      if (await requirePro('AI Heal')) runAutofix('all');
    }),
    vscode.commands.registerCommand('shipgate.toggleWatch', () => toggleWatch()),
    vscode.commands.registerCommand('shipgate.viewProofBundle', () => viewProofBundle()),
    vscode.commands.registerCommand('shipgate.exportReport', () => exportReport()),
    vscode.commands.registerCommand('shipgate.openDashboard', () => {
      const config = vscode.workspace.getConfiguration('shipgate');
      const url = config.get<string>('dashboardApiUrl', 'http://localhost:3001');
      vscode.env.openExternal(vscode.Uri.parse(url));
    }),
    vscode.commands.registerCommand('shipgate.setApiToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your ShipGate Personal Access Token (starts with sg_)',
        password: true,
        placeHolder: 'sg_...',
        validateInput: (v) => v && !v.startsWith('sg_') ? 'Token must start with sg_' : null,
      });
      if (token) {
        await context.secrets.store('shipgate.pat', token);
        await proService.refresh();
        const plan = proService.isPro() ? 'Pro' : 'Free';
        vscode.window.showInformationMessage(`ShipGate API token saved (${plan} plan). Scan results will now sync to the dashboard.`);
      }
    }),
    vscode.commands.registerCommand('shipgate.clearApiToken', async () => {
      await context.secrets.delete('shipgate.pat');
      await proService.refresh();
      vscode.window.showInformationMessage('ShipGate API token removed.');
    }),
    vscode.commands.registerCommand('shipgate.showFindings', () => showFindings()),
    vscode.commands.registerCommand('shipgate.clearFindings', () => clearFindings()),
    vscode.commands.registerCommand('shipgate.trustScore', () => runInTerminal('trust-score', 'ShipGate Trust Score')),
    vscode.commands.registerCommand('shipgate.coverage', () => runInTerminal('coverage', 'ShipGate Coverage')),
    vscode.commands.registerCommand('shipgate.drift', () => runInTerminal('drift', 'ShipGate Drift')),
    vscode.commands.registerCommand('shipgate.securityReport', () => runInTerminal('security-report', 'ShipGate Security')),
    vscode.commands.registerCommand('shipgate.compliance', () => runInTerminal('compliance soc2', 'ShipGate Compliance')),
    vscode.commands.registerCommand('shipgate.policyCheck', () => runInTerminal('policy check', 'ShipGate Policy')),
    vscode.commands.registerCommand('shipgate.genSpec', () => runGenSpec()),
    vscode.commands.registerCommand('shipgate.fmtSpecs', () => runInTerminal('fmt .', 'ShipGate Format')),
    vscode.commands.registerCommand('shipgate.migrateSpecs', () => runInTerminal('migrate .', 'ShipGate Migrate')),
    vscode.commands.registerCommand('shipgate.lintSpecs', () => runInTerminal('lint .', 'ShipGate Lint')),
    vscode.commands.registerCommand('shipgate.chaosTest', () => runInTerminal('chaos .', 'ShipGate Chaos')),
    vscode.commands.registerCommand('shipgate.simulate', () => runInTerminal('simulate', 'ShipGate Simulate')),
    vscode.commands.registerCommand('shipgate.pbt', () => runInTerminal('pbt .', 'ShipGate PBT')),
    vscode.commands.registerCommand('shipgate.go', () => runGoCommand()),
    vscode.commands.registerCommand('shipgate.goFix', () => runGoCommand('--fix')),
    vscode.commands.registerCommand('shipgate.goDeep', () => runGoCommand('--deep')),
    vscode.commands.registerCommand('shipgate.vibeGenerate', async () => {
      if (await requirePro('Safe Vibe Coding')) runVibeCommand();
    }),
    vscode.commands.registerCommand('shipgate.scanProject', () => runInTerminal('scan .', 'ShipGate Scan')),
    vscode.commands.registerCommand('shipgate.genPython', () => runGenForLanguage('python')),
    vscode.commands.registerCommand('shipgate.genRust', () => runGenForLanguage('rust')),
    vscode.commands.registerCommand('shipgate.genGo', () => runGenForLanguage('go')),
    vscode.commands.registerCommand('shipgate.genTypescript', () => runGenForLanguage('ts')),
    vscode.commands.registerCommand('shipgate.genGraphql', () => runGenForLanguage('graphql')),
    vscode.commands.registerCommand('shipgate.genOpenapi', () => runGenForLanguage('openapi')),
    vscode.commands.registerCommand('shipgate.inferSpecs', async () => {
      if (await requirePro('Infer Specs (AI)')) runInTerminal('scan . --provider anthropic', 'ShipGate Infer Specs');
    }),
    vscode.commands.registerCommand('shipgate.openEvidence', () => runInTerminal('open', 'ShipGate Evidence')),
  );

  // Proof Bundle Commands
  registerProofCommands(context);

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

async function requirePro(featureName: string): Promise<boolean> {
  await proService.ensureFresh();
  if (proService.isPro()) return true;

  const choice = await vscode.window.showWarningMessage(
    `"${featureName}" requires ShipGate Pro.`,
    { modal: true },
    'Upgrade to Pro',
    'Set API Token',
  );
  if (choice === 'Upgrade to Pro') {
    vscode.env.openExternal(vscode.Uri.parse(proService.getUpgradeUrl()));
  } else if (choice === 'Set API Token') {
    await vscode.commands.executeCommand('shipgate.setApiToken');
    await proService.refresh();
    return proService.isPro();
  }
  return false;
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

    // Parse JSON output
    const cliResult = JSON.parse(stdout);
    
    // Format data for webview
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'workspace';
    const dashboardData = {
      projectName: workspaceName,
      branch: 'main', // TODO: Get from git
      verdict: cliResult.result?.verdict || cliResult.verdict || 'UNKNOWN',
      score: cliResult.result?.score || cliResult.score || 0,
      files: cliResult.result?.files || cliResult.files || [],
      coverage: cliResult.result?.coverage || cliResult.coverage || { specced: 0, total: 0 },
      duration: cliResult.result?.duration || cliResult.duration || 0,
      timestamp: new Date().toISOString()
    };

    // Send results to sidebar
    sidebarProvider.sendMessage({ type: 'results', data: dashboardData });

    // Update diagnostics and codelens with findings
    const findings = fileFindingsToFindings(dashboardData.files, cwd);
    diagnostics.update(findings, cwd);
    codeLens.updateFindings(findings);

    // Update status bar
    statusBar.setVerdict(dashboardData.verdict, dashboardData.score);

    // Fire-and-forget: POST result to dashboard API
    postToDashboard(cliResult as any, cwd, extensionContext);
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

function runInTerminal(subcommand: string, title: string): void {
  const terminal = vscode.window.createTerminal(title);
  terminal.show();
  terminal.sendText(`${getCliCommand()} ${subcommand}`);
}

async function runGenSpec(): Promise<void> {
  const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!activeFile) {
    vscode.window.showWarningMessage('Open a source file to generate a spec for it');
    return;
  }
  const terminal = vscode.window.createTerminal('ShipGate Gen Spec');
  terminal.show();
  terminal.sendText(`${getCliCommand()} gen "${activeFile}"`);
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
terminal.sendText(`${getCliCommand()} export --format pdf`);
}

async function runGoCommand(flag?: string) {
  const terminal = vscode.window.createTerminal('ShipGate Go');
  terminal.show();
  const extra = flag ? ` ${flag}` : '';
  terminal.sendText(`${getCliCommand()} go .${extra}`);
}

async function runVibeCommand() {
  const prompt = await vscode.window.showInputBox({
    prompt: 'Describe what you want to build',
    placeHolder: 'e.g. "Build me a todo app with auth and Stripe payments"',
    title: 'ShipGate Vibe — Safe Vibe Coding',
  });
  if (!prompt) return;

  const lang = await vscode.window.showQuickPick(
    ['typescript', 'python', 'rust', 'go'],
    { placeHolder: 'Target language (default: typescript)', title: 'Language' }
  );

  const terminal = vscode.window.createTerminal('ShipGate Vibe');
  terminal.show();
  const langFlag = lang && lang !== 'typescript' ? ` --lang ${lang}` : '';
  terminal.sendText(`${getCliCommand()} vibe "${prompt}"${langFlag}`);
}

async function runGenForLanguage(target: string) {
  const files = await vscode.workspace.findFiles('**/*.isl', '**/node_modules/**', 20);
  if (files.length === 0) {
    vscode.window.showWarningMessage('No .isl spec files found. Run `shipgate init` or `shipgate scan` first.');
    return;
  }

  let specFile: string;
  if (files.length === 1) {
    specFile = files[0].fsPath;
  } else {
    const picked = await vscode.window.showQuickPick(
      files.map(f => ({
        label: vscode.workspace.asRelativePath(f),
        uri: f,
      })),
      { placeHolder: 'Select ISL spec file', title: `Generate ${target.toUpperCase()} code` }
    );
    if (!picked) return;
    specFile = picked.uri.fsPath;
  }

  const terminal = vscode.window.createTerminal(`ShipGate Gen ${target}`);
  terminal.show();
  terminal.sendText(`${getCliCommand()} gen ${target} "${specFile}"`);
}

async function showFindings() {
  vscode.commands.executeCommand('workbench.actions.view.problems');
}

async function clearFindings() {
  diagnostics.update([], '');
  vscode.window.showInformationMessage('ShipGate findings cleared');
}

/**
 * Upload scan results to the ShipGate Dashboard API (v1).
 * Uses PAT from VS Code secret storage for authentication.
 */
async function postToDashboard(scanResult: any, cwd: string, context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('shipgate');
  const apiUrl = config.get<string>('dashboardApiUrl', 'http://localhost:3001');

  const token = await context.secrets.get('shipgate.pat');
  if (!token) return; // Not authenticated, silently skip

  const result = scanResult?.result ?? scanResult;
  if (!result?.verdict) return;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'shipgate-vscode',
  };

  try {
    // Resolve orgId
    const meRes = await fetch(`${apiUrl}/api/v1/me`, { headers });
    if (!meRes.ok) return;
    const me = (await meRes.json()) as { data?: { orgs?: Array<{ id: string }> } };
    const orgId = me.data?.orgs?.[0]?.id;
    if (!orgId) return;

    // Resolve project name from workspace folder
    const projectName = cwd.split(/[\\/]/).pop() || 'unknown';

    // Ensure project
    const projRes = await fetch(`${apiUrl}/api/v1/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, name: projectName }),
    });
    if (!projRes.ok) return;
    const proj = (await projRes.json()) as { data?: { id: string } };
    const projectId = proj.data?.id;
    if (!projectId) return;

    // Get git info
    let commitSha: string | undefined;
    let branch: string | undefined;
    try {
      const cp = await import('child_process');
      commitSha = cp.execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
      branch = cp.execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
    } catch { /* not a git repo */ }

    // Create run
    const runRes = await fetch(`${apiUrl}/api/v1/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orgId, projectId, agentType: 'vscode', commitSha, branch }),
    });
    if (!runRes.ok) return;
    const run = (await runRes.json()) as { data?: { id: string } };
    const runId = run.data?.id;
    if (!runId) return;

    // Build findings from scan results
    const files: any[] = result.files ?? [];
    const findings = files.flatMap((f: any) =>
      [...(f.blockers ?? []), ...(f.errors ?? [])].map((v: any) => ({
        severity: v.severity === 'error' ? 'high' : v.severity === 'warning' ? 'medium' : 'low',
        category: v.rule ?? 'general',
        title: v.rule ?? 'violation',
        filePath: f.file,
        lineStart: v.line,
        message: v.message ?? v.description ?? String(v),
        fingerprint: `${f.file}:${v.rule ?? 'unknown'}:${v.line ?? 0}`,
      }))
    );

    // Upload findings
    if (findings.length > 0) {
      await fetch(`${apiUrl}/api/v1/runs/${runId}/findings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ findings }),
      });
    }

    // Complete run
    await fetch(`${apiUrl}/api/v1/runs/${runId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        status: 'completed',
        verdict: result.verdict,
        score: result.score ?? 0,
        durationMs: result.duration ?? 0,
      }),
    });
  } catch {
    // Silently ignore upload failures
  }
}

export function deactivate() {
  console.log('ShipGate extension deactivated');
}
