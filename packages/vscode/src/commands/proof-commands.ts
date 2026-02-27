import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

let extensionContext: vscode.ExtensionContext;

export function registerProofCommands(context: vscode.ExtensionContext) {
  extensionContext = context;
  
  context.subscriptions.push(
    vscode.commands.registerCommand('shipgate.showProofBundle', showProofBundle),
    vscode.commands.registerCommand('shipgate.verifyThisFile', verifyThisFile),
    vscode.commands.registerCommand('shipgate.explainFinding', explainFinding),
    vscode.commands.registerCommand('shipgate.generateComplianceReport', generateComplianceReport),
    vscode.commands.registerCommand('shipgate.showVerificationEvidence', showVerificationEvidence),
    vscode.commands.registerCommand('shipgate.showPropertyDetails', showPropertyDetails),
    vscode.commands.registerCommand('shipgate.showRouteEvidence', showRouteEvidence),
    vscode.commands.registerCommand('shipgate.suppressFinding', suppressFinding),
  );
}

async function showProofBundle() {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const bundlePath = path.join(cwd, '.shipgate', 'proof-bundle.json');
  try {
    const doc = await vscode.workspace.openTextDocument(bundlePath);
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch {
    vscode.window.showWarningMessage('Proof bundle not found. Run a scan first.');
  }
}

async function verifyThisFile() {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('No active file');
    return;
  }

  const filePath = activeEditor.document.uri.fsPath;
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Verifying file...',
      cancellable: false,
    },
    async () => {
      try {
        const cliPath = getCliPath();
        const { stdout } = await execAsync(`${cliPath} verify "${filePath}" --json`, { cwd });
        const result = JSON.parse(stdout);

        vscode.window.showInformationMessage(
          `Verification: ${result.verdict} (${result.trustScore || 0}%)`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Verification failed: ${err.message}`);
      }
    }
  );
}

async function explainFinding(args?: { propertyId?: string; file?: string; line?: number }) {
  if (!args) {
    vscode.window.showWarningMessage('No finding selected');
    return;
  }

  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  const bundlePath = path.join(cwd, '.shipgate', 'proof-bundle.json');
  try {
    const content = await fs.readFile(bundlePath, 'utf-8');
    const bundle = JSON.parse(content);

    const property = bundle.properties?.find((p: any) => p.id === args.propertyId);
    if (!property) {
      vscode.window.showWarningMessage('Property not found in bundle');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'findingExplanation',
      `Finding: ${property.name}`,
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );

    panel.webview.html = getExplanationHtml(property);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to load evidence: ${err.message}`);
  }
}

async function generateComplianceReport() {
  const frameworks = ['soc2', 'hipaa', 'pci-dss', 'iso27001'];
  
  const selected = await vscode.window.showQuickPick(frameworks, {
    placeHolder: 'Select compliance framework',
  });

  if (!selected) return;

  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Generating ${selected.toUpperCase()} compliance report...`,
      cancellable: false,
    },
    async () => {
      try {
        const cliPath = getCliPath();
        await execAsync(`${cliPath} compliance --framework ${selected} --output .shipgate/${selected}-report.md`, { cwd });

        const reportPath = path.join(cwd, '.shipgate', `${selected}-report.md`);
        const doc = await vscode.workspace.openTextDocument(reportPath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`${selected.toUpperCase()} report generated`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Report generation failed: ${err.message}`);
      }
    }
  );
}

async function showVerificationEvidence(uri: vscode.Uri) {
  const filePath = uri.fsPath;
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  const bundlePath = path.join(cwd, '.shipgate', 'proof-bundle.json');
  try {
    const content = await fs.readFile(bundlePath, 'utf-8');
    const bundle = JSON.parse(content);

    const relPath = path.relative(cwd, filePath).replace(/\\/g, '/');
    const fileProperties = bundle.properties?.filter((p: any) => 
      p.evidence?.some((e: any) => e.file && e.file.includes(relPath))
    ) || [];

    const panel = vscode.window.createWebviewPanel(
      'fileEvidence',
      `Evidence: ${path.basename(filePath)}`,
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );

    panel.webview.html = getFileEvidenceHtml(filePath, fileProperties);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to load evidence: ${err.message}`);
  }
}

async function showPropertyDetails(args: { propertyId: string }) {
  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  const bundlePath = path.join(cwd, '.shipgate', 'proof-bundle.json');
  try {
    const content = await fs.readFile(bundlePath, 'utf-8');
    const bundle = JSON.parse(content);

    const property = bundle.properties?.find((p: any) => p.id === args.propertyId);
    if (!property) {
      vscode.window.showWarningMessage('Property not found');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'propertyDetails',
      `Property: ${property.name}`,
      vscode.ViewColumn.Beside,
      { enableScripts: false }
    );

    panel.webview.html = getPropertyDetailsHtml(property);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to load property: ${err.message}`);
  }
}

async function showRouteEvidence(route: any) {
  const panel = vscode.window.createWebviewPanel(
    'routeEvidence',
    `Route: ${route.method} ${route.routePath}`,
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  panel.webview.html = getRouteEvidenceHtml(route);
}

async function suppressFinding(args: { propertyId: string; file: string; line: number; reason?: string }) {
  const reason = await vscode.window.showInputBox({
    prompt: 'Reason for suppression (will be documented in proof bundle)',
    placeHolder: 'e.g., False positive - validated manually',
  });

  if (!reason) return;

  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!cwd) return;

  try {
    const suppressionPath = path.join(cwd, '.shipgate', 'suppressions.json');
    let suppressions: any[] = [];

    try {
      const content = await fs.readFile(suppressionPath, 'utf-8');
      suppressions = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    suppressions.push({
      propertyId: args.propertyId,
      file: args.file,
      line: args.line,
      reason,
      suppressedBy: process.env.USER || 'unknown',
      suppressedAt: new Date().toISOString(),
    });

    await fs.writeFile(suppressionPath, JSON.stringify(suppressions, null, 2));

    vscode.window.showInformationMessage('Finding suppressed and documented');

    // Re-run verification to update the proof bundle
    vscode.commands.executeCommand('shipgate.verify');
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to suppress finding: ${err.message}`);
  }
}

function getCliPath(): string {
  const extensionPath = extensionContext.extensionUri.fsPath;
  const cliPath = extensionPath.replace(/packages[\/\\]vscode/, 'packages/cli/dist/cli.cjs');
  
  const fs = require('fs');
  if (fs.existsSync(cliPath)) {
    return `node "${cliPath}"`;
  }
  
  return 'npx shipgate';
}

function getExplanationHtml(property: any): string {
  const evidenceHtml = property.evidence?.map((e: any) => `
    <div class="evidence ${e.status}">
      <h3>${getStatusIcon(e.status)} ${e.type}</h3>
      <p>${e.description || 'No description'}</p>
      ${e.file ? `<code>${e.file}:${e.line}</code>` : ''}
    </div>
  `).join('') || '<p>No evidence available</p>';

  return `<!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: system-ui; padding: 20px; }
      .evidence { border: 1px solid #ddd; padding: 12px; margin: 8px 0; border-radius: 4px; }
      .proven { border-color: #4caf50; }
      .partial { border-color: #ff9800; }
      .failed { border-color: #f44336; }
      code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
    </style>
  </head>
  <body>
    <h1>${property.name}</h1>
    <p><strong>Status:</strong> ${property.status}</p>
    <p><strong>Confidence:</strong> ${Math.round(property.confidence * 100)}%</p>
    <h2>Evidence</h2>
    ${evidenceHtml}
    ${property.suggestion ? `<h2>Suggestion</h2><p>${property.suggestion}</p>` : ''}
  </body>
  </html>`;
}

function getFileEvidenceHtml(filePath: string, properties: any[]): string {
  const propertiesHtml = properties.map(p => `
    <div class="property ${p.status}">
      <h3>${getStatusIcon(p.status)} ${p.name}</h3>
      <p>Status: ${p.status} (${Math.round(p.confidence * 100)}% confidence)</p>
    </div>
  `).join('') || '<p>No properties verified for this file</p>';

  return `<!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: system-ui; padding: 20px; }
      .property { border: 1px solid #ddd; padding: 12px; margin: 8px 0; border-radius: 4px; }
      .proven { border-color: #4caf50; }
      .partial { border-color: #ff9800; }
      .failed { border-color: #f44336; }
    </style>
  </head>
  <body>
    <h1>Verification Evidence</h1>
    <p><strong>File:</strong> ${path.basename(filePath)}</p>
    <h2>Properties</h2>
    ${propertiesHtml}
  </body>
  </html>`;
}

function getPropertyDetailsHtml(property: any): string {
  return getExplanationHtml(property);
}

function getRouteEvidenceHtml(route: any): string {
  return `<!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: system-ui; padding: 20px; }
      .status { padding: 4px 12px; border-radius: 4px; display: inline-block; margin: 4px; }
      .proven { background: #4caf50; color: white; }
      .partial { background: #ff9800; color: white; }
      .failed { background: #f44336; color: white; }
      .unverified { background: #9e9e9e; color: white; }
    </style>
  </head>
  <body>
    <h1>${route.method || 'GET'} ${route.routePath || 'Unknown route'}</h1>
    <h2>Verification Status</h2>
    <div class="status ${route.auth}">${getStatusIcon(route.auth)} Auth: ${route.auth}</div>
    <div class="status ${route.validation}">${getStatusIcon(route.validation)} Validation: ${route.validation}</div>
    <div class="status ${route.errorHandling}">${getStatusIcon(route.errorHandling)} Error Handling: ${route.errorHandling}</div>
  </body>
  </html>`;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'proven': return '✅';
    case 'partial': return '⚠️';
    case 'failed': return '❌';
    default: return '⚪';
  }
}
