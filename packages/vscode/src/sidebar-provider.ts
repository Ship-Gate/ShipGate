import * as path from 'path';
import * as vscode from 'vscode';
import { getWebviewContent } from './webview/complete-content';

// Commands that map 1:1 to a registered VS Code command
const COMMAND_MAP: Record<string, string> = {
  verify:         'shipgate.verify',
  verifyFile:     'shipgate.verifyFile',
  ship:           'shipgate.ship',
  autofix:        'shipgate.autofix',
  autofixAll:     'shipgate.autofixAll',
  init:           'shipgate.init',
  openDashboard:  'shipgate.openDashboard',
  openSettings:   'workbench.action.openSettings',
  viewProofBundle:'shipgate.viewProofBundle',
  exportReport:   'shipgate.exportReport',
  trustScore:     'shipgate.trustScore',
  coverage:       'shipgate.coverage',
  drift:          'shipgate.drift',
  securityReport: 'shipgate.securityReport',
  compliance:     'shipgate.compliance',
  policyCheck:    'shipgate.policyCheck',
  genSpec:        'shipgate.genSpec',
  fmtSpecs:       'shipgate.fmtSpecs',
  migrateSpecs:   'shipgate.migrateSpecs',
  lintSpecs:      'shipgate.lintSpecs',
  chaosTest:      'shipgate.chaosTest',
  simulate:       'shipgate.simulate',
  pbt:            'shipgate.pbt',
  rerun:          'shipgate.verify',
  healAll:        'shipgate.autofixAll',
  viewLogs:       'shipgate.exportReport',
};

export class ShipGateSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'shipgate.sidebar';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data: { command: string; file?: string; line?: number; hash?: string }) => {
      const { command } = data;

      if (command === 'openFile') {
        void this._openFile(data.file ?? '', data.line ?? 1);
        return;
      }

      if (command === 'copyBundleHash') {
        if (data.hash) {
          void vscode.env.clipboard.writeText(data.hash);
          void vscode.window.showInformationMessage('Bundle hash copied');
        }
        return;
      }

      if (command === 'openSettings') {
        void vscode.commands.executeCommand('workbench.action.openSettings', 'shipgate');
        return;
      }

      const vsCommand = COMMAND_MAP[command];
      if (vsCommand) {
        void vscode.commands.executeCommand(vsCommand);
      }
    });

    // Restore last state
    const lastState = this._context.workspaceState.get('shipgate.lastResults');
    if (lastState) {
      void webviewView.webview.postMessage({ type: 'results', data: lastState });
    }
  }

  private _getHtmlForWebview(_webview: vscode.Webview): string {
    return getWebviewContent();
  }

  private async _openFile(file: string, line: number): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        void vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      // Strip query strings and fragments (e.g. webpack source maps: file.js?v=hash)
      const cleanFile = file.split('?')[0].split('#')[0];

      // Resolve to absolute path (handles both absolute and relative inputs)
      const fullPath = path.resolve(workspaceRoot, cleanFile);

      const uri = vscode.Uri.file(fullPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      const position = new vscode.Position(Math.max(0, line - 1), 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    } catch (error) {
      void vscode.window.showErrorMessage(`Failed to open file: ${String(error)}`);
    }
  }

  public sendMessage(msg: { type: string; [key: string]: unknown }) {
    if (msg.type === 'results') {
      void this._context.workspaceState.update('shipgate.lastResults', msg.data);
    }
    void this._view?.webview.postMessage(msg);
  }
}
