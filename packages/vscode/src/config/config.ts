/**
 * Shipgate Configuration
 *
 * Reads VS Code settings (shipgate.*) and detects .shipgate.yml
 * in workspace root.
 */

import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { join } from 'path';

export interface ShipgateConfig {
  /** Path to shipgate/isl executable (empty = auto-detect) */
  executablePath: string;
  /** Custom config file path (empty = auto-detect .shipgate.yml) */
  configPath: string;
  /** Scan project root (empty = workspace root) */
  projectRoot: string;
  /** Run scan on save */
  scanOnSave: boolean;
}

const DEFAULT_CONFIG: ShipgateConfig = {
  executablePath: '',
  configPath: '',
  projectRoot: '',
  scanOnSave: false,
};

export function getShipgateConfig(workspaceRoot: string): ShipgateConfig {
  const cfg = vscode.workspace.getConfiguration('shipgate');
  const executablePath = cfg.get<string>('scan.executablePath', '');
  const configPath = cfg.get<string>('scan.configPath', '');
  const projectRoot = cfg.get<string>('scan.projectRoot', '');
  const scanOnSave = cfg.get<boolean>('scan.scanOnSave', false);

  return {
    ...DEFAULT_CONFIG,
    executablePath: executablePath?.trim() ?? '',
    configPath: configPath?.trim() ?? '',
    projectRoot: projectRoot?.trim() || workspaceRoot,
    scanOnSave,
  };
}

/** Detect .shipgate.yml in workspace root */
export function detectShipgateConfigFile(workspaceRoot: string): string | null {
  const candidates = [
    join(workspaceRoot, '.shipgate.yml'),
    join(workspaceRoot, '.shipgate.yaml'),
    join(workspaceRoot, 'shipgate.config.yml'),
    join(workspaceRoot, 'shipgate.config.yaml'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}
