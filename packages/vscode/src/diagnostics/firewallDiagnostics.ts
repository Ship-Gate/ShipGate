/**
 * Firewall Diagnostics + Code Actions
 *
 * Precise inline violation markers with rich metadata and one-click fix suggestions.
 *
 * How it works:
 *  1. firewallResultToDiagnostics() builds Diagnostic[] with exact ranges,
 *     severity, tags, related-info, and stashes the full violation in `data`.
 *  2. FirewallCodeActionProvider reads back that `data` and creates
 *     CodeAction[] (quick-fixes, suppress, add-to-allowlist) for every
 *     diagnostic the cursor touches.
 */

import * as vscode from 'vscode';
import type { FirewallResult, PolicyViolation, QuickFix } from '@isl-lang/firewall';
import { violationsToDiagnostics } from '../services/firewallService';

// ============================================================================
// Constants
// ============================================================================

const SOURCE = 'Shipgate Firewall';
const FIREWALL_DIAGNOSTIC_CODE_PREFIX = 'shipgate-firewall';

const SUPPORTED_LANGUAGES = new Set([
  'typescript', 'typescriptreact', 'javascript', 'javascriptreact',
]);

// ============================================================================
// Tier  ➜  DiagnosticSeverity
// ============================================================================

function tierToSeverity(tier: 'hard_block' | 'soft_block' | 'warn'): vscode.DiagnosticSeverity {
  switch (tier) {
    case 'hard_block':  return vscode.DiagnosticSeverity.Error;
    case 'soft_block':  return vscode.DiagnosticSeverity.Warning;
    case 'warn':        return vscode.DiagnosticSeverity.Information;
    default:            return vscode.DiagnosticSeverity.Warning;
  }
}

// ============================================================================
// Tier  ➜  DiagnosticTag (deprecated / unnecessary for visual markers)
// ============================================================================

function tierToTags(violation: PolicyViolation): vscode.DiagnosticTag[] {
  const tags: vscode.DiagnosticTag[] = [];
  if (violation.policyId === 'pii/console-in-production') {
    tags.push(vscode.DiagnosticTag.Unnecessary);
  }
  if (
    violation.policyId === 'auth/jwt-none-algorithm' ||
    violation.policyId === 'auth/hardcoded-credentials'
  ) {
    tags.push(vscode.DiagnosticTag.Deprecated);
  }
  return tags;
}

// ============================================================================
// Tier label for human-readable prefix
// ============================================================================

function tierLabel(tier: 'hard_block' | 'soft_block' | 'warn'): string {
  switch (tier) {
    case 'hard_block':  return 'BLOCKED';
    case 'soft_block':  return 'WARNING';
    case 'warn':        return 'INFO';
    default:            return 'WARNING';
  }
}

// ============================================================================
// Build precise range — widens zero-length to full line for visibility
// ============================================================================

function buildRange(
  doc: vscode.TextDocument | undefined,
  line: number,
  column: number,
  length: number
): vscode.Range {
  if (length > 0) {
    return new vscode.Range(line, column, line, column + length);
  }
  // Zero-length: underline the full non-whitespace content of the line
  if (doc && line < doc.lineCount) {
    const text = doc.lineAt(line).text;
    const trimStart = text.length - text.trimStart().length;
    const trimEnd = text.trimEnd().length;
    if (trimEnd > trimStart) {
      return new vscode.Range(line, trimStart, line, trimEnd);
    }
  }
  return new vscode.Range(line, 0, line, 80);
}

// ============================================================================
// Result  ➜  Diagnostic[]
// ============================================================================

export function firewallResultToDiagnostics(
  uri: vscode.Uri,
  result: FirewallResult,
  doc?: vscode.TextDocument
): vscode.Diagnostic[] {
  const diags: vscode.Diagnostic[] = [];
  const items = violationsToDiagnostics(result);

  for (const { line, column, length, violation } of items) {
    const severity = tierToSeverity(violation.tier);
    const range = buildRange(doc, line, column, length);

    // Build message: "[BLOCKED] Ghost route /api/foo — Remove this reference or add to truthpack"
    const prefix = tierLabel(violation.tier);
    const suggestion = violation.suggestion ? ` — ${violation.suggestion}` : '';
    const message = `[${prefix}] ${violation.message}${suggestion}`;

    const diag = new vscode.Diagnostic(range, message, severity);
    diag.source = SOURCE;
    diag.code = {
      value: violation.policyId,
      target: vscode.Uri.parse(`https://shipgate.dev/rules/${violation.policyId}`),
    };
    diag.tags = tierToTags(violation);

    // Stash full violation for the CodeActionProvider
    diag.data = {
      violation,
      uri: uri.toString(),
    };

    diags.push(diag);
  }

  return diags;
}

// ============================================================================
// CodeActionProvider — quick-fixes for every firewall diagnostic
// ============================================================================

export class FirewallCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== SOURCE || !diag.data) continue;

      const { violation } = diag.data as { violation: PolicyViolation };
      if (!violation) continue;

      // ── Quick-fixes from the firewall engine ─────────────────────────
      if (violation.quickFixes?.length) {
        for (const qf of violation.quickFixes) {
          const action = this.buildQuickFixAction(document, diag, violation, qf);
          if (action) actions.push(action);
        }
      }

      // ── Auto-generated fix based on policy type ──────────────────────
      const autoFix = this.buildAutoFix(document, diag, violation);
      if (autoFix) actions.push(autoFix);

      // ── Suppress line ────────────────────────────────────────────────
      actions.push(this.buildSuppressLineAction(document, diag, violation));

      // ── Learn more ───────────────────────────────────────────────────
      actions.push(this.buildLearnMoreAction(violation));
    }

    return actions;
  }

  // --------------------------------------------------------------------------
  // Engine-provided quick fix  (replace / add / remove / allow_pattern)
  // --------------------------------------------------------------------------

  private buildQuickFixAction(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
    _violation: PolicyViolation,
    qf: QuickFix
  ): vscode.CodeAction | undefined {
    const action = new vscode.CodeAction(qf.label, vscode.CodeActionKind.QuickFix);
    action.diagnostics = [diag];
    action.isPreferred = true;

    const edit = new vscode.WorkspaceEdit();

    switch (qf.type) {
      case 'replace': {
        edit.replace(document.uri, diag.range, qf.value);
        break;
      }
      case 'add': {
        const insertPos = new vscode.Position(diag.range.start.line, 0);
        edit.insert(document.uri, insertPos, qf.value + '\n');
        break;
      }
      case 'remove': {
        const fullLine = document.lineAt(diag.range.start.line);
        edit.delete(document.uri, fullLine.rangeIncludingLineBreak);
        break;
      }
      case 'allow_pattern': {
        // Allow_pattern doesn't edit the file — it opens settings
        action.command = {
          command: 'workbench.action.openSettings',
          title: 'Add to firewall allowlist',
          arguments: ['shipgate.firewall'],
        };
        return action;
      }
      default:
        return undefined;
    }

    action.edit = edit;
    return action;
  }

  // --------------------------------------------------------------------------
  // Auto-generated fix based on the policy ID
  // --------------------------------------------------------------------------

  private buildAutoFix(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
    violation: PolicyViolation
  ): vscode.CodeAction | undefined {
    const policyId = violation.policyId;
    const lineNum = diag.range.start.line;
    const lineText = document.lineAt(lineNum).text;

    // ── console.log → remove line ──────────────────────────────────
    if (policyId === 'pii/console-in-production') {
      const action = new vscode.CodeAction(
        'Remove console.log',
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [diag];
      action.isPreferred = true;
      const edit = new vscode.WorkspaceEdit();
      edit.delete(document.uri, document.lineAt(lineNum).rangeIncludingLineBreak);
      action.edit = edit;
      return action;
    }

    // ── Hardcoded credentials → replace with env var ───────────────
    if (policyId === 'auth/hardcoded-credentials') {
      const envMatch = lineText.match(
        /['"`](sk_live_|pk_live_|sk_test_|AKIA|password|secret|api_key|apikey|auth_token)[\w]*['"`]/i
      );
      if (envMatch) {
        const name = envMatch[1]?.toUpperCase().replace(/[^A-Z_]/g, '_') ?? 'SECRET';
        const envName = `${name}_KEY`;
        const action = new vscode.CodeAction(
          `Replace with process.env.${envName}`,
          vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diag];
        action.isPreferred = true;
        const edit = new vscode.WorkspaceEdit();
        const matchStart = lineText.indexOf(envMatch[0]);
        edit.replace(
          document.uri,
          new vscode.Range(lineNum, matchStart, lineNum, matchStart + envMatch[0].length),
          `process.env.${envName}`
        );
        action.edit = edit;
        return action;
      }
    }

    // ── Missing rate limit → add middleware ─────────────────────────
    if (policyId.startsWith('rate-limit/')) {
      const action = new vscode.CodeAction(
        'Add rateLimit middleware',
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [diag];
      const edit = new vscode.WorkspaceEdit();
      const indent = lineText.match(/^(\s*)/)?.[1] ?? '';
      edit.insert(
        document.uri,
        new vscode.Position(lineNum, 0),
        `${indent}// Rate limit: add express-rate-limit middleware\n${indent}// app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));\n`
      );
      action.edit = edit;
      return action;
    }

    // ── Payment amount from client → add comment ───────────────────
    if (policyId === 'payments/client-side-amount' || policyId === 'payments/client-side-discount') {
      const action = new vscode.CodeAction(
        'Add server-side validation comment',
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [diag];
      const edit = new vscode.WorkspaceEdit();
      const indent = lineText.match(/^(\s*)/)?.[1] ?? '';
      edit.insert(
        document.uri,
        new vscode.Position(lineNum, 0),
        `${indent}// FIXME: Calculate amount server-side from product prices — never trust client\n`
      );
      action.edit = edit;
      return action;
    }

    // ── Missing idempotency → add key ──────────────────────────────
    if (policyId === 'payments/missing-idempotency') {
      const action = new vscode.CodeAction(
        'Add idempotencyKey parameter',
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [diag];
      const edit = new vscode.WorkspaceEdit();
      // Find closing paren/brace and inject idempotencyKey
      const indent = lineText.match(/^(\s*)/)?.[1] ?? '';
      edit.insert(
        document.uri,
        new vscode.Position(lineNum, 0),
        `${indent}// Add: { idempotencyKey: crypto.randomUUID() }\n`
      );
      action.edit = edit;
      return action;
    }

    // ── Auth bypass → remove the bypass ────────────────────────────
    if (policyId === 'auth/bypass-detected') {
      const action = new vscode.CodeAction(
        'Remove auth bypass',
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [diag];
      action.isPreferred = true;
      const edit = new vscode.WorkspaceEdit();
      edit.delete(document.uri, document.lineAt(lineNum).rangeIncludingLineBreak);
      action.edit = edit;
      return action;
    }

    // ── Missing input validation → add zod stub ────────────────────
    if (policyId === 'intent/validation-missing') {
      const bodyMatch = lineText.match(/(req|request)\.body\.(\w+)/);
      const field = bodyMatch?.[2] ?? 'input';
      const action = new vscode.CodeAction(
        `Add validation for ${field}`,
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [diag];
      const edit = new vscode.WorkspaceEdit();
      const indent = lineText.match(/^(\s*)/)?.[1] ?? '';
      edit.insert(
        document.uri,
        new vscode.Position(lineNum, 0),
        `${indent}// const ${field}Schema = z.string(); // validate with zod\n${indent}// const ${field} = ${field}Schema.parse(req.body.${field});\n`
      );
      action.edit = edit;
      return action;
    }

    return undefined;
  }

  // --------------------------------------------------------------------------
  // Suppress for this line  (// shipgate-ignore-next-line <policy>)
  // --------------------------------------------------------------------------

  private buildSuppressLineAction(
    document: vscode.TextDocument,
    diag: vscode.Diagnostic,
    violation: PolicyViolation
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Suppress: ${violation.policyId} for this line`,
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diag];

    const lineNum = diag.range.start.line;
    const indent = document.lineAt(lineNum).text.match(/^(\s*)/)?.[1] ?? '';

    const edit = new vscode.WorkspaceEdit();
    edit.insert(
      document.uri,
      new vscode.Position(lineNum, 0),
      `${indent}// shipgate-ignore-next-line ${violation.policyId}\n`
    );
    action.edit = edit;
    return action;
  }

  // --------------------------------------------------------------------------
  // Learn more  (opens docs in browser)
  // --------------------------------------------------------------------------

  private buildLearnMoreAction(violation: PolicyViolation): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Learn more: ${violation.policyId}`,
      vscode.CodeActionKind.QuickFix
    );
    action.command = {
      command: 'vscode.open',
      title: 'Open rule documentation',
      arguments: [vscode.Uri.parse(`https://shipgate.dev/rules/${violation.policyId}`)],
    };
    return action;
  }
}

// ============================================================================
// Registration helper (called from extension.ts)
// ============================================================================

export function registerFirewallCodeActions(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const selector = [...SUPPORTED_LANGUAGES].map((lang) => ({
    language: lang,
    scheme: 'file',
  }));

  const provider = vscode.languages.registerCodeActionsProvider(
    selector,
    new FirewallCodeActionProvider(),
    { providedCodeActionKinds: FirewallCodeActionProvider.providedCodeActionKinds }
  );

  context.subscriptions.push(provider);
  return provider;
}
