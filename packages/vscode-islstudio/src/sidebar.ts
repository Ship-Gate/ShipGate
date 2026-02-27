/**
 * ISL Studio Sidebar Tree View Provider
 * 
 * Displays:
 * - Intent blocks (from ISL specs)
 * - Gate status and violations
 * - Proof bundles
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class ISLStudioTreeProvider implements vscode.TreeDataProvider<ISLTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ISLTreeItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<void | ISLTreeItem | null | undefined> = this._onDidChangeTreeData.event;

  private gateResult: GateResult | null = null;
  private intentBlocks: IntentBlock[] = [];
  private proofBundles: ProofBundle[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  updateGateResult(result: GateResult): void {
    this.gateResult = result;
    this.refresh();
  }

  updateIntentBlocks(blocks: IntentBlock[]): void {
    this.intentBlocks = blocks;
    this.refresh();
  }

  updateProofBundles(bundles: ProofBundle[]): void {
    this.proofBundles = bundles;
    this.refresh();
  }

  getTreeItem(element: ISLTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ISLTreeItem): Promise<ISLTreeItem[]> {
    if (!element) {
      // Root level: show main sections
      return [
        new ISLTreeItem('Gate Status', vscode.TreeItemCollapsibleState.Expanded, 'gate-status'),
        new ISLTreeItem('Intent Blocks', vscode.TreeItemCollapsibleState.Collapsed, 'intent-blocks'),
        new ISLTreeItem('Violations', vscode.TreeItemCollapsibleState.Collapsed, 'violations'),
        new ISLTreeItem('Proof Bundles', vscode.TreeItemCollapsibleState.Collapsed, 'proof-bundles'),
      ];
    }

    switch (element.contextValue) {
      case 'gate-status':
        return this.getGateStatusItems();
      case 'intent-blocks':
        return this.getIntentBlockItems();
      case 'violations':
        return this.getViolationItems();
      case 'proof-bundles':
        return this.getProofBundleItems();
      case 'violation':
        return this.getViolationDetails(element);
      default:
        return [];
    }
  }

  private getGateStatusItems(): ISLTreeItem[] {
    if (!this.gateResult) {
      return [new ISLTreeItem('No gate run yet', vscode.TreeItemCollapsibleState.None, 'no-gate')];
    }

    const verdict = this.gateResult.verdict;
    const icon = verdict === 'SHIP' ? '$(pass)' : '$(error)';
    const color = verdict === 'SHIP' ? undefined : new vscode.ThemeColor('errorForeground');

    return [
      new ISLTreeItem(
        `${icon} ${verdict} (${this.gateResult.score}/100)`,
        vscode.TreeItemCollapsibleState.None,
        'gate-verdict',
        undefined,
        color
      ),
      new ISLTreeItem(
        `Violations: ${this.gateResult.violations.length}`,
        vscode.TreeItemCollapsibleState.None,
        'gate-violations-count'
      ),
    ];
  }

  private getIntentBlockItems(): ISLTreeItem[] {
    if (this.intentBlocks.length === 0) {
      return [new ISLTreeItem('No intent blocks found', vscode.TreeItemCollapsibleState.None, 'no-intents')];
    }

    return this.intentBlocks.map(block => {
      const item = new ISLTreeItem(
        `${block.name} (${block.intents.length} intents)`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'intent-block',
        block.file
      );
      item.tooltip = `File: ${block.file}\nIntents: ${block.intents.join(', ')}`;
      item.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(block.file)],
      };
      return item;
    });
  }

  private getViolationItems(): ISLTreeItem[] {
    if (!this.gateResult || this.gateResult.violations.length === 0) {
      return [new ISLTreeItem('No violations', vscode.TreeItemCollapsibleState.None, 'no-violations')];
    }

    // Group by severity
    const bySeverity = new Map<string, Violation[]>();
    for (const v of this.gateResult.violations) {
      const severity = v.severity || 'medium';
      const list = bySeverity.get(severity) || [];
      list.push(v);
      bySeverity.set(severity, list);
    }

    const items: ISLTreeItem[] = [];
    for (const [severity, violations] of bySeverity) {
      const icon = severity === 'critical' ? '$(error)' : severity === 'high' ? '$(warning)' : '$(info)';
      const item = new ISLTreeItem(
        `${icon} ${severity.toUpperCase()} (${violations.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        `violations-${severity}`
      );
      items.push(item);
    }

    return items;
  }

  private getViolationDetails(element: ISLTreeItem): ISLTreeItem[] {
    if (!this.gateResult) return [];

    const severity = element.contextValue?.replace('violations-', '') || '';
    const violations = this.gateResult.violations.filter(v => (v.severity || 'medium') === severity);

    return violations.map(v => {
      const item = new ISLTreeItem(
        `${v.ruleId}: ${v.message}`,
        vscode.TreeItemCollapsibleState.None,
        'violation',
        v.file
      );
      item.tooltip = `File: ${v.file}\nLine: ${v.line || 'N/A'}\nRule: ${v.ruleId}`;
      item.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(v.file), { selection: new vscode.Range((v.line || 1) - 1, 0, (v.line || 1) - 1, 1000) }],
      };
      return item;
    });
  }

  private getProofBundleItems(): ISLTreeItem[] {
    if (this.proofBundles.length === 0) {
      return [new ISLTreeItem('No proof bundles', vscode.TreeItemCollapsibleState.None, 'no-proofs')];
    }

    return this.proofBundles.map(bundle => {
      const item = new ISLTreeItem(
        `${bundle.id} (${bundle.verdict})`,
        vscode.TreeItemCollapsibleState.None,
        'proof-bundle',
        bundle.path
      );
      item.tooltip = `Score: ${bundle.score}/100\nVerdict: ${bundle.verdict}\nTimestamp: ${bundle.timestamp}`;
      item.command = {
        command: 'islstudio.viewProofBundle',
        title: 'View Proof Bundle',
        arguments: [bundle.path],
      };
      return item;
    });
  }
}

class ISLTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly filePath?: string,
    public readonly color?: vscode.ThemeColor
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    if (filePath) {
      this.resourceUri = vscode.Uri.file(filePath);
    }
    if (color) {
      this.color = color;
    }
  }
}

// ============================================================================
// Types
// ============================================================================

export interface GateResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  violations: Violation[];
}

export interface Violation {
  ruleId: string;
  file: string;
  message: string;
  line?: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

export interface IntentBlock {
  name: string;
  file: string;
  intents: string[];
}

export interface ProofBundle {
  id: string;
  path: string;
  verdict: string;
  score: number;
  timestamp: string;
}
