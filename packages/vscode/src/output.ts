import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('ShipGate');
  }
  return channel;
}

export function log(message: string): void {
  getOutputChannel().appendLine(`[${new Date().toISOString()}] ${message}`);
}

export function logError(message: string, error?: unknown): void {
  const errMsg = error instanceof Error ? error.message : String(error ?? '');
  getOutputChannel().appendLine(`[${new Date().toISOString()}] ERROR: ${message}${errMsg ? ` — ${errMsg}` : ''}`);
}

export function logScanStart(scope: string): void {
  log(`━━━ Scan started (${scope}) ━━━`);
}

export function logScanEnd(verdict: string, score: number, duration: number): void {
  log(`━━━ Scan complete: ${verdict} (score: ${score}, ${duration}ms) ━━━`);
}

export function logFinding(severity: string, file: string, line: number, message: string): void {
  const icon = severity === 'error' ? '✗' : severity === 'warning' ? '⚠' : 'ℹ';
  log(`  ${icon} [${severity}] ${file}:${line} — ${message}`);
}

export function dispose(): void {
  channel?.dispose();
  channel = undefined;
}
