/**
 * ShipGate ISL — VS Code Extension
 *
 * Entry point. Wires up the LSP client, ShipGate commands,
 * CodeLens provider, status bar, diagnostics, and Shipgate scan features.
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { createLanguageClient, startClient, stopClient } from './client';
import { registerCommands } from './commands-legacy';
import {
  registerGenerateCommand,
  registerGenerateSkeletonCommand,
  registerVerifyCommands,
  registerCoverageCommand,
  registerValidateCommand,
  getLastCoverageReport,
} from './commands/index';
import { registerScanCommands } from './commands/scan';
import { registerHealCommand, type HealState } from './commands/heal';
import { registerVibeCommand, type VibeState } from './commands/vibe';
import { registerVibePanelCommands } from './commands/vibePanel';
import { VibePanelProvider, type VibePanelState } from './views/vibePanel/vibePanelProvider';
import { ProService } from './services/proService';
import { getShipgateConfig } from './config/config';
import { registerCodeLensProvider, setupDiagnosticsIntegration, registerCodeToIslCodeAction } from './providers/index';
import { createShipGateStatusBar, ShipGateStatusBar } from './views/status-bar';
import { createShipgateScanStatusBar } from './views/shipgateStatusBar';
import { ShipgateSidebarProvider, type SidebarState } from './views/shipgateSidebar/sidebarProvider';
import { ShipgateReportPanel } from './views/shipgateReport/reportPanel';
import { loadGitHubState, acquireGitHubToken } from './commands/github';
import { runCodeToIsl } from './commands/codeToIsl';
import { runIntentBuild, type IntentBuilderState } from './commands/intentBuild';
import { join } from 'path';
import { readdirSync, existsSync } from 'fs';
import { FirewallService } from './services/firewallService';
import { firewallResultToDiagnostics, registerFirewallCodeActions } from './diagnostics/firewallDiagnostics';
import { ship } from './services/shipService';

let client: LanguageClient | undefined;
let statusBar: ShipGateStatusBar | undefined;
let scanStatusBar: ReturnType<typeof createShipgateScanStatusBar> | undefined;
let outputChannel: vscode.OutputChannel;

// ============================================================================
// Activation
// ============================================================================

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const startTime = Date.now();

  outputChannel = vscode.window.createOutputChannel('ShipGate ISL');
  outputChannel.appendLine('[ShipGate] Extension activating...');

  // ── Status bar (renders immediately for perceived speed) ──
  statusBar = createShipGateStatusBar(context);

  // ── Shipgate scan: status bar, diagnostics, sidebar, report, commands ──
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  const scanState = { lastResult: null as import('./model/types').ScanResult | null, workspaceRoot };
  const scanDiagnosticCollection = vscode.languages.createDiagnosticCollection('shipgate-scan');
  context.subscriptions.push(scanDiagnosticCollection);

  const githubState = {
    connected: false,
    repo: null as import('./services/githubService').GitHubRepoInfo | null,
    pulls: [] as import('./services/githubService').GitHubPullRequest[],
    workflowRuns: [] as import('./services/githubService').GitHubWorkflowRun[],
    error: null as string | null,
  };

  function getWorkflows(): { name: string; path: string }[] {
    const wfDir = join(workspaceRoot, '.github', 'workflows');
    if (!existsSync(wfDir)) return [];
    try {
      return readdirSync(wfDir)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .map((f) => ({ name: f.replace(/\.(yml|yaml)$/, ''), path: join(wfDir, f) }));
    } catch {
      return [];
    }
  }

  let islGeneratePath: string | null = null;
  const updateIslPath = () => {
    const uri = vscode.window.activeTextEditor?.document.uri;
    islGeneratePath = uri?.scheme === 'file' ? vscode.workspace.asRelativePath(uri) : null;
  };
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateIslPath)
  );
  updateIslPath();

  const firewallService = new FirewallService();
  if (workspaceRoot) {
    firewallService.configure(workspaceRoot);
  }

  const firewallDiagnosticCollection = vscode.languages.createDiagnosticCollection('shipgate-firewall');
  context.subscriptions.push(firewallDiagnosticCollection);

  // ── Firewall quick-fix code actions ──
  registerFirewallCodeActions(context);

  const API_KEY_SECRET = 'shipgate.intentBuilder.apiKey';
  let storedApiKey: string | undefined;

  // Load stored API key on activation
  void context.secrets.get(API_KEY_SECRET).then(
    (key) => {
      storedApiKey = key;
      if (intentBuilderState.phase === 'idle') {
        intentBuilderState.hasApiKey = !!key;
        sidebarProvider.refresh();
      }
    },
    () => { /* silent */ }
  );

  let intentBuilderState: IntentBuilderState = {
    phase: 'idle',
    prompt: null,
    message: null,
    error: null,
    score: null,
    verdict: null,
    hasApiKey: false,
  };

  let healState: HealState = {
    phase: 'idle',
    message: null,
    error: null,
    iterations: 0,
    finalScore: null,
    finalVerdict: null,
    patchedFiles: [],
  };

  let vibeState: VibeState = {
    phase: 'idle',
    prompt: null,
    message: null,
    error: null,
    verdict: null,
    score: null,
    outputDir: null,
    fileCount: 0,
  };

  let vibePanelState: VibePanelState = {
    phase: 'idle',
    prompt: null,
    message: null,
    error: null,
    verdict: null,
    score: null,
    outputDir: null,
    files: [],
    stages: [],
    overallProgress: 0,
    etaSeconds: null,
    certificate: null,
  };

  // ── Pro service ──
  const proService = new ProService(context.secrets);
  void proService.initialize().then(() => {
    if (sidebarProvider) sidebarProvider.refresh();
  });
  context.subscriptions.push(proService.onChange(() => sidebarProvider.refresh()));

  const getState = (): SidebarState => ({
    scan: scanState.lastResult,
    github: githubState,
    workflows: getWorkflows(),
    islGeneratePath,
    firewall: firewallService.getState(),
    intentBuilder: {
      ...intentBuilderState,
      hasApiKey: intentBuilderState.hasApiKey || !!proService.getApiKey(),
    },
    heal: healState,
    pro: proService.getState(),
  });

  scanStatusBar = createShipgateScanStatusBar(context, 'shipgate.runScan');
  scanStatusBar.setVerdict('Idle');

  const sidebarProvider = new ShipgateSidebarProvider(context.extensionUri, getState, workspaceRoot);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('shipgate.sidebar', sidebarProvider)
  );

  const vibePanelProvider = new VibePanelProvider(
    context.extensionUri,
    context,
    () => vibePanelState,
    workspaceRoot
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('shipgate.vibePanel', vibePanelProvider)
  );

  async function requirePro(featureName: string): Promise<boolean> {
    if (proService.isPro()) return true;
    const choice = await vscode.window.showInformationMessage(
      `${featureName} is a Shipgate Pro feature. Log in or create an account to continue.`,
      { modal: true },
      'Log In',
      'Create Account',
      'Enter License Key'
    );
    if (choice === 'Log In') {
      vscode.env.openExternal(vscode.Uri.parse(proService.getUpgradeUrl() + '?mode=login'));
    } else if (choice === 'Create Account') {
      vscode.env.openExternal(vscode.Uri.parse(proService.getUpgradeUrl()));
    } else if (choice === 'Enter License Key') {
      const token = await vscode.window.showInputBox({
        prompt: 'Paste your Shipgate Pro license token',
        placeHolder: 'eyJhbG...',
        ignoreFocusOut: true,
      });
      if (token?.trim()) {
        const ok = await proService.activate(token.trim());
        return ok;
      }
    }
    return false;
  }

  registerVibePanelCommands(
    context,
    vibePanelState,
    () => vibePanelProvider.refresh(),
    () => proService.getApiKey(),
    requirePro
  );

  registerScanCommands(
    context,
    scanState,
    scanDiagnosticCollection,
    (result) => {
      scanState.lastResult = result;
      sidebarProvider.refresh();
      const root = (scanState.workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath) ?? '';
      const config = root ? getShipgateConfig(root) : null;
      ShipgateReportPanel.refreshCurrent(result, root, config?.configPath ?? null);
    },
    scanStatusBar
  );

  // ── Heal command (AI-powered verify→fix→re-verify loop) ──
  registerHealCommand(context, scanState, healState, () => {
    sidebarProvider.refresh();
  }, () => proService.getApiKey(), requirePro);

  // ── Vibe command (Safe Vibe Coding: NL → ISL → codegen → verify → SHIP) ──
  registerVibeCommand(context, vibeState, () => {
    sidebarProvider.refresh();
  }, () => proService.getApiKey(), requirePro);

  // ── Open Vibe Panel command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.openVibePanel', () => {
      vscode.commands.executeCommand('shipgate.vibePanel.focus');
    })
  );

  // ── GitHub commands (OAuth magic link via VS Code auth provider) ──
  const runGitHubConnect = async () => {
    const token = await acquireGitHubToken(true);
    if (!token) {
      vscode.window.showWarningMessage('GitHub sign-in was cancelled or unavailable.');
      return;
    }
    const state = await loadGitHubState(workspaceRoot, token);
    Object.assign(githubState, state);
    sidebarProvider.refresh();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.githubConnect', runGitHubConnect),
    vscode.commands.registerCommand('shipgate.githubRefresh', runGitHubConnect)
  );

  // ── Re-connect GitHub when auth sessions change (catches delayed magic-link redirects) ──
  context.subscriptions.push(
    vscode.authentication.onDidChangeSessions((e) => {
      if (e.provider.id === 'github' && workspaceRoot) {
        acquireGitHubToken(false).then((token) => {
          if (token) {
            return loadGitHubState(workspaceRoot, token);
          }
          return null;
        }).then((state) => {
          if (state) {
            Object.assign(githubState, state);
            sidebarProvider.refresh();
          }
        }).catch(() => { /* silent */ });
      }
    })
  );

  // ── Auto-connect GitHub on activation (non-interactive — uses cached session) ──
  if (workspaceRoot) {
    acquireGitHubToken(false).then((autoToken) => {
      if (autoToken) {
        return loadGitHubState(workspaceRoot, autoToken);
      }
      return null;
    }).then((state) => {
      if (state) {
        Object.assign(githubState, state);
        sidebarProvider.refresh();
      }
    }).catch(() => { /* silent */ });
  }

  // ── Ship command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.ship', async () => {
      const token = await acquireGitHubToken(true);
      if (!token) {
        vscode.window.showWarningMessage('GitHub sign-in required to ship. Please connect first.');
        return;
      }

      // Gate on scan verdict
      const lastVerdict = scanState.lastResult?.result?.verdict;
      if (lastVerdict === 'NO_SHIP') {
        const force = await vscode.window.showWarningMessage(
          'Scan verdict is NO_SHIP. Fix violations before shipping.',
          'Ship Anyway',
          'Run Scan',
          'Cancel'
        );
        if (force === 'Run Scan') {
          await vscode.commands.executeCommand('shipgate.runScan');
          return;
        }
        if (force !== 'Ship Anyway') return;
      }

      // Collect options via quick input
      const message = await vscode.window.showInputBox({
        prompt: 'Commit message',
        value: 'shipgate: verified ship',
        placeHolder: 'Describe your changes',
      });
      if (!message) return;

      const prTitle = await vscode.window.showInputBox({
        prompt: 'PR title',
        value: message,
        placeHolder: 'Pull request title',
      });
      if (!prTitle) return;

      const draftChoice = await vscode.window.showQuickPick(
        [
          { label: 'Ready for review', value: false },
          { label: 'Draft PR', value: true },
        ],
        { placeHolder: 'PR type' }
      );
      if (!draftChoice) return;

      // Execute ship
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Shipgate: Shipping to GitHub...',
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Committing changes...' });
          try {
            const result = await ship({
              cwd: workspaceRoot,
              token,
              message,
              prTitle,
              draft: draftChoice.value,
            });

            if (result.prUrl) {
              const open = await vscode.window.showInformationMessage(
                `Shipped! PR #${result.prNumber} created on ${result.branch}`,
                'Open PR',
                'Close'
              );
              if (open === 'Open PR') {
                vscode.env.openExternal(vscode.Uri.parse(result.prUrl));
              }
            } else {
              vscode.window.showInformationMessage(
                `Pushed to ${result.branch} (${result.commitSha})${result.error ? ` — ${result.error}` : ''}`
              );
            }

            // Refresh GitHub state
            const newState = await loadGitHubState(workspaceRoot, token);
            Object.assign(githubState, newState);
            sidebarProvider.refresh();
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Ship failed: ${msg}`);
          }
        }
      );
    })
  );

  // ── Pro commands ──
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.upgradePro', () => {
      vscode.env.openExternal(vscode.Uri.parse(proService.getUpgradeUrl()));
    }),
    vscode.commands.registerCommand('shipgate.activatePro', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Paste your Shipgate Pro license token',
        placeHolder: 'eyJhbG...',
        ignoreFocusOut: true,
      });
      if (token?.trim()) {
        await proService.activate(token.trim());
      }
    }),
    vscode.commands.registerCommand('shipgate.signOut', async () => {
      await proService.deactivate();
      vscode.window.showInformationMessage('Signed out of Shipgate Pro.');
    })
  );

  // ── URI handler for magic link activation (vscode://shipgate.shipgate-isl/activate?token=...) ──
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        if (uri.path === '/activate') {
          const params = new URLSearchParams(uri.query);
          const token = params.get('token');
          if (token) {
            void proService.activate(token);
          }
        }
      },
    })
  );

  // ── Open Walkthrough command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.openWalkthrough', () => {
      vscode.commands.executeCommand('workbench.action.openWalkthrough', 'shipgate.shipgate-isl#shipgate-walkthrough');
    })
  );

  // ── Code to ISL command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.codeToIsl', async () => {
      const editor = vscode.window.activeTextEditor;
      let targetPath = workspaceRoot;
      if (editor?.document.uri?.scheme === 'file') {
        const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        if (folder) targetPath = editor.document.uri.fsPath;
      }

      const result = await runCodeToIsl(workspaceRoot, targetPath);
      if (result.success) {
        vscode.window.showInformationMessage(
          `Generated ${result.generatedCount ?? 0} ISL spec(s) from code.`
        );
        sidebarProvider.refresh();
      } else {
        vscode.window.showErrorMessage(`Code to ISL failed: ${result.error}`);
      }
    })
  );

  // ── Intent Builder commands ──
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.intentBuild', async (prompt: string) => {
      const allowed = await requirePro('Intent Builder');
      if (!allowed) return;
      const apiKey = storedApiKey || proService.getApiKey() || undefined;
      await runIntentBuild(prompt, workspaceRoot, {
        onProgress: (state) => {
          intentBuilderState = state;
          sidebarProvider.refresh();
        },
      }, outputChannel, apiKey);
    }),
    vscode.commands.registerCommand('shipgate.setApiKey', async (key: string) => {
      await context.secrets.store(API_KEY_SECRET, key);
      storedApiKey = key;
      intentBuilderState.hasApiKey = true;
      sidebarProvider.refresh();
      vscode.window.showInformationMessage('API key saved securely.');
    }),
    vscode.commands.registerCommand('shipgate.clearApiKey', async () => {
      await context.secrets.delete(API_KEY_SECRET);
      storedApiKey = undefined;
      intentBuilderState.hasApiKey = false;
      sidebarProvider.refresh();
      vscode.window.showInformationMessage('API key removed.');
    })
  );

  // ── ShipGate commands ──
  registerGenerateCommand(context, outputChannel);
  registerGenerateSkeletonCommand(context, outputChannel);
  const diagnosticCollection = registerVerifyCommands(context, outputChannel);
  registerCoverageCommand(context, outputChannel);
  registerValidateCommand(context, () => client, outputChannel);

  // ── Legacy ISL commands (parse, typecheck, codegen, etc.) ──
  registerCommands(context, () => client, outputChannel);

  // ── CodeLens provider ──
  const codeLensProvider = registerCodeLensProvider(context);

  // ── Code to ISL code action (TypeScript/JavaScript) ──
  registerCodeToIslCodeAction(context, workspaceRoot, () => sidebarProvider.refresh());

  // ── Diagnostics integration ──
  setupDiagnosticsIntegration(context, () => client, outputChannel);

  // ── Language server (start in background so activation completes immediately) ──
  const config = vscode.workspace.getConfiguration('shipgate');
  if (config.get<boolean>('languageServer.enabled', true)) {
    void startLanguageServer(context);
  }

  // ── Watch for config changes ──
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('shipgate.languageServer.enabled')) {
        const enabled = vscode.workspace
          .getConfiguration('shipgate')
          .get<boolean>('languageServer.enabled', true);

        if (enabled && !client) {
          await startLanguageServer(context);
        } else if (!enabled && client) {
          await stopClient(client);
          client = undefined;
          statusBar?.setReady();
        }
      }
    })
  );

  // ── Refresh CodeLens on diagnostics change ──
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      codeLensProvider.refresh();
    })
  );

  // ── Refresh status bar on coverage data ──
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => {
      const report = getLastCoverageReport();
      if (report) {
        statusBar?.updateCoverage(report);
      }
    })
  );

  // ── Live Firewall on save ──
  const firewallEnabled = () =>
    vscode.workspace.getConfiguration('shipgate').get<boolean>('firewall.enabled', true);
  const firewallRunOnSave = () =>
    vscode.workspace.getConfiguration('shipgate').get<boolean>('firewall.runOnSave', true);

  context.subscriptions.push(
    firewallService.onStateChange(() => sidebarProvider.refresh())
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (!firewallEnabled() || !firewallRunOnSave()) return;
      if (doc.uri.scheme !== 'file') return;
      const filePath = doc.uri.fsPath;
      const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
      const root = folder?.uri.fsPath ?? workspaceRoot;
      if (!firewallService.isSupported(filePath)) return;

      firewallService.configure(root);
      try {
        const result = await firewallService.evaluate(filePath, doc.getText());
        const diags = firewallResultToDiagnostics(doc.uri, result, doc);
        firewallDiagnosticCollection.set(doc.uri, diags);
      } catch {
        firewallDiagnosticCollection.delete(doc.uri);
      }
    })
  );

  // Clear firewall diagnostics when document is closed
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      firewallDiagnosticCollection.delete(doc.uri);
    })
  );

  // ── Manual Run Firewall command ──
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.runFirewall', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a file to run the firewall.');
        return;
      }
      const doc = editor.document;
      if (doc.uri.scheme !== 'file') return;
      const filePath = doc.uri.fsPath;
      const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
      const root = folder?.uri.fsPath ?? workspaceRoot;
      if (!firewallService.isSupported(filePath)) {
        vscode.window.showWarningMessage('Firewall supports .ts, .tsx, .js, .jsx files only.');
        return;
      }
      firewallService.configure(root);
      try {
        const result = await firewallService.evaluate(filePath, doc.getText());
        const diags = firewallResultToDiagnostics(doc.uri, result, doc);
        firewallDiagnosticCollection.set(doc.uri, diags);
        const msg = result.allowed
          ? `Firewall: allowed (${result.violations.length} warning(s))`
          : `Firewall: blocked (${result.violations.length} violation(s))`;
        vscode.window.showInformationMessage(msg);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Firewall failed: ${message}`);
        firewallDiagnosticCollection.delete(doc.uri);
      }
    })
  );

  const activationTime = Date.now() - startTime;
  outputChannel.appendLine(`[ShipGate] Extension activated in ${activationTime}ms`);

  if (activationTime > 500) {
    outputChannel.appendLine(
      `[ShipGate] Warning: Activation took ${activationTime}ms (target: <500ms)`
    );
  }
}

// ============================================================================
// Deactivation
// ============================================================================

export async function deactivate(): Promise<void> {
  if (client) {
    await stopClient(client);
    client = undefined;
  }
  if (statusBar) {
    statusBar.dispose();
    statusBar = undefined;
  }
  if (scanStatusBar) {
    scanStatusBar.dispose();
    scanStatusBar = undefined;
  }
}

// ============================================================================
// Language Server Lifecycle
// ============================================================================

async function startLanguageServer(context: vscode.ExtensionContext): Promise<void> {
  try {
    statusBar?.setChecking();

    client = createLanguageClient(context, outputChannel);
    await startClient(client);
    context.subscriptions.push(client);

    setupClientNotifications(client);

    // Fetch server version
    try {
      const versionResult = await client.sendRequest<{ version: string }>('isl/version');
      if (versionResult?.version) {
        statusBar?.setVersion(versionResult.version);
      }
    } catch {
      // Version request not supported — continue
    }

    statusBar?.setReady();
    outputChannel.appendLine('[ShipGate] Language server started');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`[ShipGate] Failed to start language server: ${message}`);
    statusBar?.setError();

    vscode.window.showWarningMessage(
      `ShipGate: Language server failed to start: ${message}. Syntax highlighting will still work.`
    );
  }
}

function setupClientNotifications(languageClient: LanguageClient): void {
  // Server status updates
  languageClient.onNotification(
    'isl/status',
    (params: { status: string; message?: string; errorCount?: number }) => {
      switch (params.status) {
        case 'ready':
          statusBar?.setReady();
          break;
        case 'checking':
          statusBar?.setChecking();
          break;
        case 'error':
          statusBar?.setError(params.errorCount);
          if (params.message) {
            vscode.window.showErrorMessage(`ShipGate: ${params.message}`);
          }
          break;
      }
    }
  );

  // Server version updates
  languageClient.onNotification('isl/version', (params: { version: string }) => {
    statusBar?.setVersion(params.version);
  });
}
