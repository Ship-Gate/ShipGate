import * as vscode from 'vscode';
import { getWebviewContent } from './webview/content';

export class ShipGateSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'shipgate.sidebar';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { 
      enableScripts: true, 
      localResourceRoots: [this._extensionUri] 
    };
    webviewView.webview.html = getWebviewContent();

    // Restore last state
    const lastState = this._context.workspaceState.get('shipgate.lastResults');
    if (lastState) {
      webviewView.webview.postMessage({ type: 'results', data: lastState });
    }

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case 'verify': 
          vscode.commands.executeCommand('shipgate.verify'); 
          break;
        case 'verifyFile': 
          vscode.commands.executeCommand('shipgate.verifyFile'); 
          break;
        case 'ship': 
          vscode.commands.executeCommand('shipgate.ship'); 
          break;
        case 'openFile':
          const doc = await vscode.workspace.openTextDocument(msg.file);
          const line = Math.max(0, (msg.line || 1) - 1);
          vscode.window.showTextDocument(doc, { 
            selection: new vscode.Range(line, 0, line, 0) 
          });
          break;
        case 'autofix': 
          vscode.commands.executeCommand('shipgate.autofix'); 
          break;
        case 'autofixAll': 
          vscode.commands.executeCommand('shipgate.autofixAll'); 
          break;
        case 'openPR': 
          vscode.env.openExternal(vscode.Uri.parse(msg.url)); 
          break;
        case 'openDashboard': 
          vscode.commands.executeCommand('shipgate.openDashboard'); 
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'shipgate');
          break;
        case 'init':
          vscode.commands.executeCommand('shipgate.init');
          break;
        case 'viewProofBundle': 
          vscode.commands.executeCommand('shipgate.viewProofBundle'); 
          break;
        case 'exportReport': 
          vscode.commands.executeCommand('shipgate.exportReport'); 
          break;
        case 'copyBundleHash': 
          vscode.env.clipboard.writeText(msg.hash); 
          vscode.window.showInformationMessage('Bundle hash copied'); 
          break;
      }
    });
  }

  public sendMessage(msg: any) {
    if (msg.type === 'results') {
      this._context.workspaceState.update('shipgate.lastResults', msg.data);
    }
    this._view?.webview.postMessage(msg);
  }
}
