/**
 * Shipgate Diagnostics Provider
 *
 * Converts scan findings into vscode.Diagnostic objects for the Problems panel.
 * Clears stale diagnostics on new run.
 */

import * as vscode from 'vscode';
import { resolve } from 'path';
import type { ScanResult, FileFinding } from '../model/types';

const DIAGNOSTIC_SOURCE = 'Shipgate';

function severityFromStatus(status: FileFinding['status']): vscode.DiagnosticSeverity {
  switch (status) {
    case 'FAIL':
      return vscode.DiagnosticSeverity.Error;
    case 'WARN':
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

function severityFromBlockers(blockers: string[]): vscode.DiagnosticSeverity {
  return blockers.length > 0 ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
}

/**
 * Convert scan result to diagnostics grouped by file.
 */
export function scanResultToDiagnostics(
  scanResult: ScanResult,
  workspaceRoot: string
): Map<string, vscode.Diagnostic[]> {
  const byFile = new Map<string, vscode.Diagnostic[]>();

  for (const file of scanResult.result.files) {
    if (file.status === 'PASS' && file.blockers.length === 0) continue;

    const absPath = resolve(workspaceRoot, file.file);
    const diags: vscode.Diagnostic[] = [];

    for (const blocker of file.blockers) {
      diags.push({
        range: new vscode.Range(0, 0, 0, 0),
        message: blocker,
        severity: vscode.DiagnosticSeverity.Error,
        source: DIAGNOSTIC_SOURCE,
      });
    }

    for (const err of file.errors) {
      diags.push({
        range: new vscode.Range(0, 0, 0, 0),
        message: err,
        severity: severityFromStatus(file.status),
        source: DIAGNOSTIC_SOURCE,
      });
    }

    if (diags.length === 0 && file.status !== 'PASS') {
      const msg =
        file.status === 'FAIL'
          ? `Verification failed (score: ${file.score.toFixed(2)})`
          : `Warning: ${file.mode} (score: ${file.score.toFixed(2)})`;
      diags.push({
        range: new vscode.Range(0, 0, 0, 0),
        message: msg,
        severity: severityFromStatus(file.status),
        source: DIAGNOSTIC_SOURCE,
      });
    }

    if (diags.length > 0) {
      byFile.set(absPath, diags);
    }
  }

  return byFile;
}

/**
 * Apply diagnostics to the collection, clearing previous Shipgate diagnostics.
 */
export function applyScanDiagnostics(
  collection: vscode.DiagnosticCollection,
  scanResult: ScanResult,
  workspaceRoot: string
): void {
  collection.clear();

  const byFile = scanResultToDiagnostics(scanResult, workspaceRoot);
  for (const [uriStr, diags] of byFile) {
    collection.set(vscode.Uri.file(uriStr), diags);
  }
}

/**
 * Clear all Shipgate diagnostics.
 */
export function clearScanDiagnostics(collection: vscode.DiagnosticCollection): void {
  collection.clear();
}
