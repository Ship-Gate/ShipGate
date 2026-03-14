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
import * as inlineAnalyzer from './services/inlineAnalyzer';
import { ShipGateCodeActionProvider } from './services/codeActions';
import * as supplyChainChecker from './services/supplyChainChecker';
import * as deepAnalyzer from './services/deepAnalyzer';
import { TaintFlowCodeLensProvider, extractTaintFlows } from './services/taintCodeLens';
import { DiagnosticManager } from './services/diagnosticManager';
import * as output from './output';
import { createLanguageClient, startClient, stopClient } from './client';
import type { LanguageClient } from 'vscode-languageclient/node';

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
let languageClient: LanguageClient | undefined;
let taintCodeLens: TaintFlowCodeLensProvider;
let diagnosticManager: DiagnosticManager;

function getCliCommand(): string {
  const fs = require('fs');
  const pathMod = require('path');
  const extensionPath = extensionContext.extensionUri.fsPath;

  // 1. Monorepo layout: extension lives at packages/vscode
  if (/packages[\/\\]vscode/.test(extensionPath)) {
    const cliPath = extensionPath.replace(/packages[\/\\]vscode/, 'packages/cli/dist/cli.cjs');
    if (fs.existsSync(cliPath)) {
      return `node "${cliPath}"`;
    }
  }

  // 2. Workspace-local CLI (covers installed-VSIX + monorepo workspace)
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    const candidates = [
      pathMod.join(workspaceRoot, 'packages', 'cli', 'dist', 'cli.cjs'),
      pathMod.join(workspaceRoot, 'node_modules', 'shipgate', 'dist', 'cli.cjs'),
      pathMod.join(workspaceRoot, 'node_modules', '.bin', 'shipgate'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p.endsWith('.cjs') || p.endsWith('.js') ? `node "${p}"` : `"${p}"`;
      }
    }
  }

  // 3. Fallback
  return 'npx shipgate';
}

export function activate(context: vscode.ExtensionContext) {
  output.log('ShipGate extension activating...');
  extensionContext = context;

  // Pro service (server-backed license check via PAT)
  proService = new ProService(context.secrets);
  void proService.initialize().then(() => pushProStatus());

  proService.onChange(() => pushProStatus());

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

  // Code Actions (Quick Fixes)
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'typescript' },
        { language: 'typescriptreact' },
        { language: 'javascript' },
        { language: 'javascriptreact' },
      ],
      new ShipGateCodeActionProvider(),
      { providedCodeActionKinds: ShipGateCodeActionProvider.providedCodeActionKinds }
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

  // ISL Language Server (provides diagnostics, completions, hover, go-to-def for .isl files)
  const lspOutputChannel = vscode.window.createOutputChannel('ISL Language Server');
  context.subscriptions.push(lspOutputChannel);
  try {
    languageClient = createLanguageClient(context, lspOutputChannel);
    startClient(languageClient).then(() => {
      lspOutputChannel.appendLine('[ShipGate] ISL Language Server started');
    }).catch((err) => {
      lspOutputChannel.appendLine(`[ShipGate] LSP start failed: ${err.message}`);
      console.warn('ShipGate LSP: Could not start language server:', err.message);
    });
    context.subscriptions.push({ dispose: () => { if (languageClient) stopClient(languageClient); } });
  } catch (err: any) {
    lspOutputChannel.appendLine(`[ShipGate] LSP not available: ${err.message}`);
    output.log('ISL Language Server not found, running in syntax-only mode');
  }

  // Output channel
  context.subscriptions.push({ dispose: () => output.dispose() });
  output.log('ShipGate extension activated');

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
      const url = config.get<string>('dashboardApiUrl', 'https://app.shipgate.dev');
      vscode.env.openExternal(vscode.Uri.parse(url));
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
    vscode.commands.registerCommand('shipgate.go', () => runGoInline()),
    vscode.commands.registerCommand('shipgate.goFix', () => runGoInline('--fix')),
    vscode.commands.registerCommand('shipgate.goDeep', () => runGoInline('--deep')),
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
    vscode.commands.registerCommand('shipgate.openAllFailing', () => openAllFailing()),
    vscode.commands.registerCommand('shipgate.copySummary', () => copySummary()),
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
        pushProStatus();
        const state = proService.getState();
        const plan = state.plan === 'enterprise' ? 'Enterprise' : state.active ? 'Pro' : 'Free';
        vscode.window.showInformationMessage(`ShipGate API token saved (${plan} plan).`);
      }
    }),
  );

  // Missing commands — wired to real CLI or stub actions
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.generateSpec', () => runGenSpec()),
    vscode.commands.registerCommand('shipgate.verifyAll', () => runVerification('full')),
    vscode.commands.registerCommand('shipgate.validateISL', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (!activeFile?.endsWith('.isl')) {
        vscode.window.showWarningMessage('Open an .isl file to validate');
        return;
      }
      runInTerminal(`check "${activeFile}"`, 'ShipGate Validate ISL');
    }),
    vscode.commands.registerCommand('shipgate.isl.parseFile', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (!activeFile?.endsWith('.isl')) {
        vscode.window.showWarningMessage('Open an .isl file to parse');
        return;
      }
      runInTerminal(`parse "${activeFile}"`, 'ISL Parse');
    }),
    vscode.commands.registerCommand('shipgate.isl.typeCheck', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (activeFile?.endsWith('.isl')) {
        runInTerminal(`check "${activeFile}"`, 'ISL Type Check');
      } else {
        runInTerminal('check .', 'ISL Type Check');
      }
    }),
    vscode.commands.registerCommand('shipgate.isl.generateTypeScript', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (activeFile?.endsWith('.isl')) {
        runInTerminal(`gen ts "${activeFile}"`, 'ISL Gen TypeScript');
      } else {
        vscode.window.showWarningMessage('Open an .isl file to generate TypeScript');
      }
    }),
    vscode.commands.registerCommand('shipgate.isl.generateRust', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (activeFile?.endsWith('.isl')) {
        runInTerminal(`gen rust "${activeFile}"`, 'ISL Gen Rust');
      } else {
        vscode.window.showWarningMessage('Open an .isl file to generate Rust');
      }
    }),
    vscode.commands.registerCommand('shipgate.isl.openRepl', () => runInTerminal('repl', 'ISL REPL')),
    vscode.commands.registerCommand('shipgate.isl.initProject', () => runInit()),
    vscode.commands.registerCommand('shipgate.isl.verifySpec', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (activeFile?.endsWith('.isl')) {
        runInTerminal(`verify --spec "${activeFile}"`, 'ISL Verify Spec');
      } else {
        runVerification('full');
      }
    }),
    vscode.commands.registerCommand('shipgate.isl.restartServer', async () => {
      if (languageClient) {
        await stopClient(languageClient);
        await startClient(languageClient);
        vscode.window.showInformationMessage('ISL Language Server restarted.');
      } else {
        vscode.window.showWarningMessage('ISL Language Server is not running.');
      }
    }),
    vscode.commands.registerCommand('shipgate.isl.generateSkeleton', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (activeFile?.endsWith('.isl')) {
        runInTerminal(`gen ts "${activeFile}" --skeleton`, 'ISL Skeleton');
      } else {
        vscode.window.showWarningMessage('Open an .isl file first');
      }
    }),
    vscode.commands.registerCommand('shipgate.runScan', () => runInTerminal('scan .', 'ShipGate Scan')),
    vscode.commands.registerCommand('shipgate.heal', () => runInTerminal('heal .', 'ShipGate Heal')),
    vscode.commands.registerCommand('shipgate.healFile', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (activeFile) {
        runInTerminal(`heal "${activeFile}"`, 'ShipGate Heal File');
      }
    }),
    vscode.commands.registerCommand('shipgate.vibe', async () => {
      if (await requirePro('Vibe Coding')) runVibeCommand();
    }),
    vscode.commands.registerCommand('shipgate.openVibePanel', () => {
      vscode.commands.executeCommand('shipgate.sidebar.focus');
    }),
    vscode.commands.registerCommand('shipgate.openReport', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;
      const reportPath = vscode.Uri.file(`${cwd}/.shipgate/evidence/report.html`);
      try {
        await vscode.env.openExternal(reportPath);
      } catch {
        runInTerminal('open', 'ShipGate Report');
      }
    }),
    vscode.commands.registerCommand('shipgate.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'shipgate');
    }),
    vscode.commands.registerCommand('shipgate.selectWorkspaceRoot', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length <= 1) {
        vscode.window.showInformationMessage('Only one workspace root available.');
        return;
      }
      const picked = await vscode.window.showQuickPick(
        folders.map(f => ({ label: f.name, description: f.uri.fsPath, folder: f })),
        { placeHolder: 'Select workspace root for ShipGate' }
      );
      if (picked) {
        vscode.window.showInformationMessage(`ShipGate root: ${picked.label}`);
      }
    }),
    vscode.commands.registerCommand('shipgate.codeToIsl', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (activeFile) {
        runInTerminal(`isl-generate "${activeFile}"`, 'Code → ISL');
      } else {
        runInTerminal('isl-generate .', 'Code → ISL');
      }
    }),
    vscode.commands.registerCommand('shipgate.codeToIslFromFile', () => {
      const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
      if (activeFile) {
        runInTerminal(`isl-generate "${activeFile}"`, 'Code → ISL');
      } else {
        vscode.window.showWarningMessage('Open a source file first');
      }
    }),
    vscode.commands.registerCommand('shipgate.githubConnect', () => {
      const config = vscode.workspace.getConfiguration('shipgate');
      const url = config.get<string>('dashboardApiUrl', 'https://app.shipgate.dev');
      vscode.env.openExternal(vscode.Uri.parse(`${url}/api/integrations/github/connect`));
    }),
    vscode.commands.registerCommand('shipgate.githubRefresh', () => {
      vscode.window.showInformationMessage('GitHub integration refreshed.');
    }),
    vscode.commands.registerCommand('shipgate.runFirewall', () => {
      runFirewallCheck();
    }),
    vscode.commands.registerCommand('shipgate.openWalkthrough', () => {
      vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'shipgate.shipgate-isl#shipgate.walkthrough'
      );
    }),
    vscode.commands.registerCommand('shipgate.upgradePro', () => {
      vscode.env.openExternal(vscode.Uri.parse(proService.getUpgradeUrl()));
    }),
    vscode.commands.registerCommand('shipgate.activatePro', async () => {
      await vscode.commands.executeCommand('shipgate.setApiToken');
    }),
    vscode.commands.registerCommand('shipgate.signOut', async () => {
      await context.secrets.delete('shipgate.pat');
      await proService.refresh();
      pushProStatus();
      vscode.window.showInformationMessage('Signed out of ShipGate.');
    }),
  );

  // Proof Bundle Commands
  registerProofCommands(context);

  // Watch mode: re-scan on save + firewall
  let watchDebounce: ReturnType<typeof setTimeout> | null = null;
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const config = vscode.workspace.getConfiguration('shipgate');

      // Firewall on save
      if (config.get('firewall.enabled') && config.get('firewall.runOnSave')) {
        runFirewallCheck(doc.uri);
      }

      if (config.get('scanOnSave') || config.get('watchMode')) {
        if (watchDebounce) clearTimeout(watchDebounce);
        watchDebounce = setTimeout(() => {
          sidebarProvider.sendMessage({ type: 'watchEvent', file: vscode.workspace.asRelativePath(doc.uri) });
          runVerification('file', doc.uri);
        }, 1500);
      }
    })
  );

  // Inline Analyzer — real-time regex-based checks on document change
  inlineAnalyzer.activate(context);

  // Supply Chain Checker — typosquatting and deprecated dependency detection
  supplyChainChecker.activate(context);

  // Deep Analyzer — thorough security analysis on save
  deepAnalyzer.activate(context);

  // Taint Flow CodeLens — visualize source→sink taint flows
  taintCodeLens = new TaintFlowCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { language: 'typescript' },
        { language: 'typescriptreact' },
        { language: 'javascript' },
        { language: 'javascriptreact' },
      ],
      taintCodeLens
    )
  );

  // Diagnostic Manager — unified diagnostic collections
  diagnosticManager = new DiagnosticManager();
  context.subscriptions.push({ dispose: () => diagnosticManager.dispose() });

  // Auto-scan on workspace open (opt-in)
  if (vscode.workspace.getConfiguration('shipgate').get('autoScanOnOpen')) {
    setTimeout(() => runVerification('full'), 3000);
  }

  output.log('ShipGate extension activated');
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

async function checkScanLimit(): Promise<boolean> {
  await proService.ensureFresh();
  if (proService.canScan()) return true;

  const state = proService.getState();
  const choice = await vscode.window.showWarningMessage(
    `You've used all ${state.scansLimit} free scans this month (${state.scansUsed}/${state.scansLimit}). Upgrade to Pro for unlimited scans.`,
    'Upgrade to Pro',
    'Set API Token',
  );
  if (choice === 'Upgrade to Pro') {
    vscode.env.openExternal(vscode.Uri.parse(proService.getUpgradeUrl()));
  } else if (choice === 'Set API Token') {
    await vscode.commands.executeCommand('shipgate.setApiToken');
    await proService.refresh();
    return proService.canScan();
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
  if (!(await checkScanLimit())) return;
  statusBar.setScanning();
  output.logScanStart(scope);
  sidebarProvider.sendMessage({ type: 'scanning', scope, action: 'verify' });
  sidebarProvider.sendMessage({ type: 'progress', percent: 10, phase: 'Detecting project...' });

  try {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) {
      throw new Error('No workspace folder found');
    }

    const target = scope === 'file' && uri ? uri.fsPath : '.';

    sidebarProvider.sendMessage({ type: 'progress', percent: 25, phase: 'Scanning files...' });

    const { stdout } = await execAsync(`${getCliCommand()} verify ${target} --json`, {
      cwd,
      timeout: 60000
    }).catch((err) => {
      if (err.stdout) {
        return { stdout: err.stdout, stderr: err.stderr || '' };
      }
      throw err;
    });

    sidebarProvider.sendMessage({ type: 'progress', percent: 75, phase: 'Generating verdict...' });

    const cliResult = JSON.parse(stdout);

    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'workspace';
    let branch = 'main';
    try {
      const cp = require('child_process');
      branch = cp.execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
    } catch { /* not a git repo */ }

    const dashboardData = {
      projectName: workspaceName,
      branch,
      verdict: cliResult.result?.verdict || cliResult.verdict || 'UNKNOWN',
      score: cliResult.result?.score || cliResult.score || 0,
      files: cliResult.result?.files || cliResult.files || [],
      coverage: cliResult.result?.coverage || cliResult.coverage || { specced: 0, total: 0 },
      duration: cliResult.result?.duration || cliResult.duration || 0,
      timestamp: new Date().toISOString()
    };

    sidebarProvider.sendMessage({ type: 'progress', percent: 100, phase: 'Complete' });

    const specSnippet = await loadSpecPreview();
    if (specSnippet) dashboardData.specPreview = specSnippet;
    dashboardData.watchMode = !!vscode.workspace.getConfiguration('shipgate').get('watchMode');

    sidebarProvider.sendMessage({ type: 'results', data: dashboardData });

    const findings = fileFindingsToFindings(dashboardData.files, cwd);
    diagnostics.update(findings, cwd);
    codeLens.updateFindings(findings);
    diagnosticManager.updateScanFindings(findings, cwd);

    // Update taint flow visualization for active editor
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc) {
      const taintFlows = extractTaintFlows(activeDoc.getText(), activeDoc.uri.fsPath);
      taintCodeLens.updateFlows(taintFlows);
    }

    const importFindings = findings.filter(f => f.engine === 'hallucination' || f.message.includes('import'));
    const routeFindings = findings.filter(f => f.engine === 'auth-drift' || f.message.includes('route'));
    evidenceDecorations.updateEvidence(findings.map(f => ({
      file: f.file,
      line: f.line,
      type: f.severity === 'error' ? 'violation' as const : 'warning' as const,
      message: f.message,
    })));
    importDecorations.updateImportEvidence(importFindings.map(f => ({
      file: f.file,
      line: f.line,
      status: 'unverified' as const,
      message: f.message,
    })));
    evidenceCodeLens.updateRouteEvidence(routeFindings.map(f => ({
      file: f.file,
      line: f.line,
      verified: false,
      message: f.message,
    })));

    statusBar.setVerdict(dashboardData.verdict, dashboardData.score);
    output.logScanEnd(dashboardData.verdict, dashboardData.score, dashboardData.duration);
    for (const f of findings) {
      output.logFinding(f.severity, f.file, f.line, f.message);
    }

    updateFileDecorations(dashboardData.files, cwd);
    pushProStatus();
    postToDashboard(cliResult as any, cwd, extensionContext);
  } catch (err: any) {
    output.logError('Verification failed', err);
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
  if (!(await checkScanLimit())) return;
  statusBar.setScanning();
  sidebarProvider.sendMessage({ type: 'scanning', scope: 'full', action: 'ship' });
  sidebarProvider.sendMessage({ type: 'progress', percent: 10, phase: 'Initializing ship check...' });

  try {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) throw new Error('No workspace folder found');

    sidebarProvider.sendMessage({ type: 'progress', percent: 30, phase: 'Running CI gate...' });

    const { stdout } = await execAsync(`${getCliCommand()} ship --ci --json`, { cwd, timeout: 120000 })
      .catch((err) => {
        if (err.stdout) {
          return { stdout: err.stdout, stderr: err.stderr || '' };
        }
        throw err;
      });

    sidebarProvider.sendMessage({ type: 'progress', percent: 90, phase: 'Finalizing...' });
    const data = JSON.parse(stdout);

    sidebarProvider.sendMessage({ type: 'results', data });
    statusBar.setVerdict(data.verdict || 'SHIP', data.score || 100);
    pushProStatus();
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
  const newVal = !current;
  await config.update('watchMode', newVal, vscode.ConfigurationTarget.Workspace);
  sidebarProvider.sendMessage({ type: 'watchMode', enabled: newVal });
  statusBar.setWatch(newVal);
}

function updateFileDecorations(files: any[], cwd: string) {
  const pathMod = require('path');
  const statuses = files.map((f: any) => ({
    file: pathMod.resolve(cwd, f.file),
    status: f.status === 'PASS' ? 'proven' as const
      : f.status === 'FAIL' ? 'failed' as const
      : 'partial' as const,
    trustScore: Math.round((f.score || 0) * 100),
  }));
  fileDecorations.updateFileStatus(statuses);
}

async function copySummary() {
  const lastResults = extensionContext.workspaceState.get('shipgate.lastResults') as any;
  if (!lastResults) {
    vscode.window.showWarningMessage('No scan results to copy. Run a ship check first.');
    return;
  }
  const files = lastResults.files || [];
  const pass = files.filter((f: any) => f.status === 'PASS').length;
  const fail = files.filter((f: any) => f.status === 'FAIL').length;
  const warns = files.filter((f: any) => f.status === 'WARN').length;
  const issues = files.reduce((s: number, f: any) => s + (f.blockers?.length || 0) + (f.errors?.length || 0), 0);

  const lines = [
    `ShipGate Verification Summary`,
    `Verdict: ${lastResults.verdict || 'UNKNOWN'}`,
    `Score: ${lastResults.score || 0}`,
    `Files: ${files.length} (${pass} pass, ${fail} fail, ${warns} warn)`,
    `Issues: ${issues}`,
    `Coverage: ${lastResults.coverage?.specced || 0}/${lastResults.coverage?.total || 0}`,
    `Time: ${new Date(lastResults.timestamp).toLocaleString()}`,
  ];
  if (issues > 0) {
    lines.push('', 'Top Issues:');
    let shown = 0;
    for (const f of files) {
      for (const b of [...(f.blockers || []), ...(f.errors || [])]) {
        if (shown >= 5) break;
        lines.push(`  - ${f.file}: ${typeof b === 'string' ? b : b.message || b}`);
        shown++;
      }
      if (shown >= 5) break;
    }
  }
  await vscode.env.clipboard.writeText(lines.join('\n'));
  vscode.window.showInformationMessage('Summary copied to clipboard');
}

async function loadSpecPreview(): Promise<string | null> {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return null;
  const fs = require('fs');
  const pathMod = require('path');
  const specPaths = [
    pathMod.join(cwd, '.shipgate', 'specs', 'auto-generated.isl'),
    pathMod.join(cwd, '.shipgate', 'specs', 'main.isl'),
  ];
  for (const sp of specPaths) {
    if (fs.existsSync(sp)) {
      try {
        const content = fs.readFileSync(sp, 'utf8');
        return content.slice(0, 800);
      } catch { /* skip */ }
    }
  }
  return null;
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

async function runGoInline(flag?: string) {
  if (!(await checkScanLimit())) return;
  statusBar.setScanning();
  const actionName = flag === '--fix' ? 'goFix' : flag === '--deep' ? 'goDeep' : 'go';
  sidebarProvider.sendMessage({ type: 'scanning', scope: 'full', action: actionName });
  sidebarProvider.sendMessage({ type: 'progress', percent: 5, phase: 'Detecting project...' });

  try {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) throw new Error('No workspace folder found');

    const extra = flag ? ` ${flag}` : '';
    sidebarProvider.sendMessage({ type: 'progress', percent: 15, phase: 'Scanning & inferring ISL specs...' });

    const { stdout } = await execAsync(`${getCliCommand()} go .${extra} --format json`, {
      cwd,
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024,
    }).catch((err) => {
      if (err.stdout) {
        return { stdout: err.stdout, stderr: err.stderr || '' };
      }
      throw err;
    });

    sidebarProvider.sendMessage({ type: 'progress', percent: 85, phase: 'Building verdict...' });

    let data: any;
    try {
      data = JSON.parse(stdout);
    } catch {
      const lines = stdout.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        try { data = JSON.parse(lines[i]); break; } catch { /* try prev line */ }
      }
    }

    if (!data) {
      throw new Error('Could not parse shipgate go output');
    }

    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'workspace';
    let branch = 'main';
    try {
      const cp = require('child_process');
      branch = cp.execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();
    } catch { /* not a git repo */ }

    const scanResult = data.scanResult || data.result || data;
    const dashboardData = {
      projectName: workspaceName,
      branch,
      verdict: data.verdict || scanResult?.verdict || 'UNKNOWN',
      score: data.score ?? scanResult?.score ?? 0,
      files: scanResult?.files || data.files || [],
      coverage: scanResult?.coverage || data.coverage || { specced: 0, total: 0 },
      duration: data.duration || scanResult?.duration || 0,
      timestamp: new Date().toISOString()
    };

    sidebarProvider.sendMessage({ type: 'progress', percent: 100, phase: 'Complete' });

    const specSnippet = await loadSpecPreview();
    if (specSnippet) (dashboardData as any).specPreview = specSnippet;
    (dashboardData as any).watchMode = !!vscode.workspace.getConfiguration('shipgate').get('watchMode');

    sidebarProvider.sendMessage({ type: 'results', data: dashboardData });

    const findings = fileFindingsToFindings(dashboardData.files, cwd);
    diagnostics.update(findings, cwd);
    codeLens.updateFindings(findings);
    diagnosticManager.updateScanFindings(findings, cwd);
    statusBar.setVerdict(dashboardData.verdict, dashboardData.score);

    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc) {
      const taintFlows = extractTaintFlows(activeDoc.getText(), activeDoc.uri.fsPath);
      taintCodeLens.updateFlows(taintFlows);
    }

    updateFileDecorations(dashboardData.files, cwd);
    pushProStatus();
    postToDashboard(data as any, cwd, extensionContext);
  } catch (err: any) {
    const errorMsg = err.message || 'shipgate go failed';
    sidebarProvider.sendMessage({ type: 'error', message: errorMsg });
    statusBar.setError();
    vscode.window.showErrorMessage(`ShipGate Go: ${errorMsg}`);
  }
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
  const apiUrl = config.get<string>('dashboardApiUrl', 'https://app.shipgate.dev');

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

function pushProStatus() {
  const state = proService.getState();
  sidebarProvider.sendMessage({
    type: 'proStatus',
    active: state.active,
    plan: state.plan,
    email: state.email,
    scansUsed: state.scansUsed,
    scansLimit: state.scansLimit,
    canScan: state.canScan,
  });
}

async function openAllFailing() {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  const lastResults = extensionContext.workspaceState.get('shipgate.lastResults') as any;
  if (!lastResults?.files) return;

  const failingFiles = lastResults.files
    .filter((f: any) => f.status === 'FAIL')
    .slice(0, 10);

  for (const f of failingFiles) {
    const fullPath = require('path').resolve(cwd, f.file);
    try {
      const uri = vscode.Uri.file(fullPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch { /* skip */ }
  }
}

async function runFirewallCheck(uri?: vscode.Uri) {
  try {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!cwd) return;

    const target = uri ? `"${uri.fsPath}"` : '.';
    const { stdout } = await execAsync(
      `${getCliCommand()} verify ${target} --json --quick`,
      { cwd, timeout: 15000 }
    ).catch((err) => {
      if (err.stdout) return { stdout: err.stdout, stderr: err.stderr || '' };
      throw err;
    });

    const result = JSON.parse(stdout);
    const files = result?.result?.files ?? result?.files ?? [];
    const findings = fileFindingsToFindings(files, cwd);

    if (findings.length > 0) {
      diagnostics.update(findings, cwd);
      const criticalCount = findings.filter(f => f.severity === 'error').length;
      if (criticalCount > 0) {
        vscode.window.showWarningMessage(
          `ShipGate Firewall: ${criticalCount} issue${criticalCount > 1 ? 's' : ''} detected`,
          'Show Problems'
        ).then(choice => {
          if (choice === 'Show Problems') {
            vscode.commands.executeCommand('workbench.actions.view.problems');
          }
        });
      }
    }
  } catch {
    // Firewall check failed silently — don't block the developer
  }
}

export function deactivate() {
  inlineAnalyzer.deactivate();
  supplyChainChecker.deactivate();
  deepAnalyzer.deactivate();
  output.log('ShipGate extension deactivated');
}
