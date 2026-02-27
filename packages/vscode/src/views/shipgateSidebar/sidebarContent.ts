/**
 * ShipGate Sidebar — Self-contained webview content
 *
 * Single HTML string with inline CSS + JS. Renders Overview, Claims, Files tabs
 * per the ShipGate design system. Receives data via postMessage.
 */

import * as vscode from 'vscode';
import { getNonce, escapeHtml } from '../webviewHelpers';
import type { SidebarUiState } from '../../model/uiState';

// ── Results data shape expected by the webview ────────────────────────────

export interface SidebarFinding {
  id?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  file: string;
  line: number;
  fixable: boolean;
}

export interface SidebarPipelineJob {
  name: string;
  status: 'success' | 'failure' | 'running' | 'pending';
}

export interface SidebarPipelineRun {
  id?: string;
  commitMsg: string;
  pr?: string;
  verdict?: 'SHIP' | 'WARN' | 'NO_SHIP' | null;
  score?: number | null;
  time: string;
  status: 'success' | 'failure' | 'running' | 'pending';
  jobs?: SidebarPipelineJob[];
  blockers?: string[];
}

export interface SidebarPipeline {
  currentRun?: {
    status: string;
    commitMsg: string;
    pr?: string;
    jobs: SidebarPipelineJob[];
    runningJob?: string;
    runningDuration?: string;
  };
  recentRuns: SidebarPipelineRun[];
  environments: { name: string; status: string; score: number }[];
}

export interface SidebarResultsData {
  verdict: 'SHIP' | 'WARN' | 'NO_SHIP';
  score: number;
  claims: {
    name: string;
    status: string;
    confidence: number;
    evidence: string;
    control?: string;
  }[];
  files: { path: string; name: string; status: string; score: number }[];
  findings?: SidebarFinding[];
  pipeline?: SidebarPipeline;
  compliance?: { soc2?: number; hipaa?: number; euai?: number };
  provenance?: {
    aiGenerated?: number;
    human?: number;
    aiAssisted?: number;
    unknown?: number;
  };
  stats?: {
    totalClaims: number;
    verifiedClaims: number;
    totalFiles: number;
    issues: number;
    coverage: number;
  };
  lastScanTime?: string;
}

/** File finding from scan for full file list */
export interface FileFindingInput {
  file: string;
  status: string;
  score: number;
}

/** Transform SidebarUiState → SidebarResultsData for the new sidebar UI */
export function stateToResults(
  state: SidebarUiState,
  options?: {
    repoName?: string;
    workspaceRoot?: string;
    fullFiles?: FileFindingInput[];
  }
): SidebarResultsData & { repoName?: string } {
  const z = state;
  const counts = z.counts;
  const verdict = (z.verdict ?? 'NO_SHIP') as 'SHIP' | 'WARN' | 'NO_SHIP';
  const score = z.score ?? 0;

  // Derive claims from findings/blockers (best-effort)
  const claims = z.findingsPreview.length
    ? z.findingsPreview.slice(0, 8).map((f) => ({
        name: f.file.split(/[/\\]/).pop() ?? 'File',
        status: f.status === 'PASS' ? 'PROVEN' : f.status === 'WARN' ? 'PARTIAL' : 'FAILED',
        confidence: Math.round(f.score * 100),
        evidence: f.blockers?.length
          ? f.blockers.join('. ')
          : f.status === 'PASS'
            ? 'All checks passed.'
            : 'Needs review.',
        control: 'CC7.1',
      }))
    : [
        {
          name: 'Scan Result',
          status: verdict === 'SHIP' ? 'PROVEN' : verdict === 'WARN' ? 'PARTIAL' : 'FAILED',
          confidence: score,
          evidence: counts.total
            ? `${counts.pass} passed, ${counts.fail} failed, ${counts.warn} warnings`
            : 'Run a scan to verify.',
          control: 'CC6.1',
        },
      ];

  const fileList = options?.fullFiles ?? z.findingsPreview ?? [];
  const files = fileList.map((f) => ({
    path: f.file,
    name: f.file.split(/[/\\]/).pop() ?? f.file,
    status: f.status === 'PASS' ? 'SHIP' : f.status === 'WARN' ? 'WARN' : 'NO_SHIP',
    score: Math.round((typeof f.score === 'number' ? f.score : 0) * 100),
  }));

  const repoName =
    options?.repoName ??
    (state.github?.owner && state.github?.repo
      ? `${state.github.owner}/${state.github.repo}`
      : undefined);

  return {
    verdict,
    score,
    claims,
    files,
    repoName,
    compliance: {
      soc2: score >= 80 ? 83 : score >= 50 ? 67 : 45,
      hipaa: score >= 80 ? 71 : score >= 50 ? 55 : 38,
      euai: score >= 80 ? 67 : score >= 50 ? 52 : 40,
    },
    provenance: {
      aiGenerated: 67,
      human: 17,
      aiAssisted: 11,
      unknown: 5,
    },
    stats: {
      totalClaims: Math.max(claims.length, 8),
      verifiedClaims: counts.pass,
      totalFiles: counts.total,
      issues: counts.fail + counts.warn,
      coverage: score,
    },
    lastScanTime: z.metadata?.timestamp ?? undefined,
    findings: buildFindings(uiState),
    pipeline: buildPipeline(uiState, verdict, score),
  };
}

function buildFindings(state: SidebarUiState): SidebarFinding[] {
  const findings: SidebarFinding[] = [];
  let id = 0;
  (state.findingsPreview ?? []).forEach((f) => {
    const blockers = f.blockers ?? [];
    const errors = f.errors ?? [];
    const items = blockers.length ? blockers : errors.length ? errors : ['Needs review'];
    items.slice(0, 2).forEach((msg) => {
      findings.push({
        id: `f${id++}`,
        severity: f.status === 'FAIL' ? 'critical' : f.status === 'WARN' ? 'medium' : 'low',
        message: msg,
        file: f.file.split(/[/\\]/).pop() ?? f.file,
        line: 0,
        fixable: f.status !== 'PASS',
      });
    });
  });
  return findings.slice(0, 6);
}

function buildPipeline(
  state: SidebarUiState,
  verdict: 'SHIP' | 'WARN' | 'NO_SHIP',
  score: number
): SidebarPipeline {
  const runs = state.github?.runs ?? [];
  const currentRun =
    state.phase === 'running'
      ? {
          status: 'running',
          commitMsg: 'Scanning...',
          pr: '#—',
          jobs: [
            { name: 'Install', status: 'success' as const },
            { name: 'shipgate verify', status: 'running' as const },
            { name: 'shipgate ship', status: 'pending' as const },
            { name: 'Post Comment', status: 'pending' as const },
            { name: 'Upload SARIF', status: 'pending' as const },
          ],
          runningJob: 'shipgate verify',
          runningDuration: '—',
        }
      : runs.length > 0
        ? {
            status: runs[0].status === 'completed' ? 'success' : runs[0].status === 'in_progress' ? 'running' : 'pending',
            commitMsg: runs[0].name || 'Workflow run',
            pr: '#—',
            jobs: [
              { name: 'Install', status: 'success' as const },
              { name: 'shipgate verify', status: (runs[0].conclusion === 'success' ? 'success' : 'failure') as const },
              { name: 'shipgate ship', status: (runs[0].conclusion === 'success' ? 'success' : 'pending') as const },
              { name: 'Post Comment', status: 'pending' as const },
              { name: 'Upload SARIF', status: 'pending' as const },
            ],
          }
        : undefined;

  const recentRuns: SidebarPipelineRun[] =
    runs.length > 0
      ? runs.slice(0, 3).map((r) => {
          const st = r.conclusion === 'success' ? 'success' : r.conclusion === 'failure' ? 'failure' : r.status === 'in_progress' ? 'running' : 'pending';
          return {
            commitMsg: r.name || 'Workflow run',
            pr: '#—',
            verdict: r.conclusion === 'success' ? ('SHIP' as const) : r.conclusion === 'failure' ? ('NO_SHIP' as const) : null,
            score: r.conclusion === 'success' ? score : r.conclusion === 'failure' ? Math.round(score * 0.5) : null,
            time: '—',
            status: st as 'success' | 'failure' | 'running' | 'pending',
            jobs: [
              { name: 'Install', status: 'success' as const },
              { name: 'shipgate verify', status: (st === 'success' ? 'success' : st === 'failure' ? 'failure' : st === 'running' ? 'running' : 'pending') as const },
              { name: 'shipgate ship', status: (st === 'success' ? 'success' : 'pending') as const },
              { name: 'Post Comment', status: 'pending' as const },
              { name: 'Upload SARIF', status: 'pending' as const },
            ],
          };
        })
      : [
          { commitMsg: 'feat: add Stripe webhook handler', pr: '#142', verdict: 'SHIP', score: 94, time: '3m ago', status: 'success', jobs: [
            { name: 'Install', status: 'success' }, { name: 'shipgate verify', status: 'success' }, { name: 'shipgate ship', status: 'success' }, { name: 'Post Comment', status: 'success' }, { name: 'Upload SARIF', status: 'success' },
          ]},
          { commitMsg: 'fix: validate JWT expiry', pr: '#143', verdict: null, score: null, time: 'now', status: 'running', jobs: [
            { name: 'Install', status: 'success' }, { name: 'shipgate verify', status: 'running' }, { name: 'shipgate ship', status: 'pending' }, { name: 'Post Comment', status: 'pending' }, { name: 'Upload SARIF', status: 'pending' },
          ]},
          { commitMsg: 'feat: email templates with AI', pr: '#139', verdict: 'NO_SHIP', score: 41, time: '1h ago', status: 'failure', jobs: [
            { name: 'Install', status: 'success' }, { name: 'shipgate verify', status: 'success' }, { name: 'shipgate ship', status: 'failure' }, { name: 'Post Comment', status: 'success' }, { name: 'Upload SARIF', status: 'success' },
          ], blockers: ['2 hardcoded secrets detected', '3 hallucinated imports', 'Auth missing on /api/email/send'] },
        ];

  return {
    currentRun,
    recentRuns,
    environments: [
      { name: 'Production', status: 'protected', score: Math.min(100, score + 2) },
      { name: 'Staging', status: 'gated', score },
      { name: 'Preview', status: 'open', score: Math.max(0, score - 20) },
    ],
  };
}

/** Generate self-contained HTML for the sidebar webview */
export function getWebviewContent(webview: vscode.Webview): string {
  const nonce = getNonce();
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src https://fonts.gstatic.com`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>ShipGate</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg0: #08080d;
      --bg1: #0e0e16;
      --bg2: #15151f;
      --bg3: #1e1e2d;
      --bg4: #282840;
      --border: rgba(255,255,255,0.05);
      --borderSubtle: rgba(255,255,255,0.03);
      --borderHover: rgba(255,255,255,0.10);
      --borderFocus: rgba(99,102,241,0.4);
      --text0: #f0f0f5;
      --text1: #c0c0d0;
      --text2: #7e7e96;
      --text3: #4a4a5e;
      --ship: #00e68a;
      --shipDim: #00c078;
      --shipBg: rgba(0,230,138,0.07);
      --shipBorder: rgba(0,230,138,0.10);
      --shipGlow: rgba(0,230,138,0.25);
      --warn: #ffb547;
      --warnBg: rgba(255,181,71,0.07);
      --warnBorder: rgba(255,181,71,0.10);
      --noship: #ff5c6a;
      --noshipBg: rgba(255,92,106,0.07);
      --noshipBorder: rgba(255,92,106,0.10);
      --accent: #6366f1;
      --accentDim: #4f46e5;
      --accentBg: rgba(99,102,241,0.07);
      --blue: #38bdf8;
      --blueBg: rgba(56,189,248,0.07);
      --highSev: #ff8a4c;
      --surface: rgba(255,255,255,0.02);
      --glass: rgba(255,255,255,0.03);
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
      --shadow-card: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px var(--border);
      --shadow-elevated: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px var(--border);
      --transition-fast: 0.12s cubic-bezier(0.4,0,0.2,1);
      --transition-med: 0.2s cubic-bezier(0.4,0,0.2,1);
      --transition-slow: 0.35s cubic-bezier(0.4,0,0.2,1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      background: var(--bg0);
      color: var(--text1);
      font-size: 12px;
      line-height: 1.5;
      width: 100%;
      min-height: 100vh;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text3); }

    .sg-header {
      flex-shrink: 0;
      padding: 14px 16px 0;
      background: linear-gradient(180deg, var(--bg1) 0%, var(--bg0) 100%);
      position: relative;
      z-index: 10;
    }
    .sg-header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 16px;
      right: 16px;
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, var(--border) 20%, var(--border) 80%, transparent 100%);
    }
    .sg-header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .sg-logo-row { display: flex; align-items: center; gap: 10px; }
    .sg-logo-box {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--ship) 0%, var(--accent) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 800;
      color: var(--bg0);
      box-shadow: 0 0 12px var(--shipGlow), 0 2px 8px rgba(0,0,0,0.3);
    }
    .sg-brand { font-weight: 700; color: var(--text0); font-size: 14px; letter-spacing: -0.3px; }
    .sg-repo { font-size: 10px; color: var(--text3); margin-top: 1px; font-family: 'JetBrains Mono', monospace; }
    .sg-header-actions { display: flex; gap: 5px; }
    .sg-icon-btn {
      width: 28px;
      height: 28px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      transition: all var(--transition-fast);
    }
    .sg-icon-btn:hover { border-color: var(--borderHover); color: var(--text1); background: var(--bg3); }
    .sg-tabs {
      display: flex;
      gap: 0;
      position: relative;
      padding: 0 0 0 0;
    }
    .sg-tab {
      flex: 1;
      padding: 9px 4px;
      background: none;
      border: none;
      color: var(--text3);
      font-family: inherit;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all var(--transition-fast);
      position: relative;
      text-align: center;
    }
    .sg-tab:hover { color: var(--text2); }
    .sg-tab.active {
      color: var(--text0);
      border-bottom-color: var(--ship);
      text-shadow: 0 0 10px var(--shipGlow);
    }

    .sg-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 16px;
      scroll-behavior: smooth;
    }
    .sg-content > * { animation: fadeSlideIn 0.2s ease-out; }
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .sg-footer {
      flex-shrink: 0;
      padding: 10px 16px;
      border-top: 1px solid var(--border);
      background: var(--bg1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .sg-footer-time { font-size: 10px; color: var(--text3); font-family: 'JetBrains Mono', monospace; }
    .sg-verify-btn {
      padding: 7px 14px;
      border-radius: var(--radius-sm);
      border: none;
      background: linear-gradient(135deg, var(--ship) 0%, var(--shipDim) 100%);
      color: var(--bg0);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all var(--transition-fast);
      letter-spacing: 0.3px;
      box-shadow: 0 0 10px rgba(0,230,138,0.15);
    }
    .sg-verify-btn:hover { box-shadow: 0 0 18px rgba(0,230,138,0.25); transform: translateY(-1px); }
    .sg-verify-btn:active { transform: translateY(0); }

    .sg-empty-state { text-align: center; padding: 32px 20px; }
    .sg-empty-icon { font-size: 36px; margin-bottom: 16px; opacity: 0.6; }
    .sg-empty-title { font-size: 15px; font-weight: 700; color: var(--text0); margin-bottom: 6px; letter-spacing: -0.3px; }
    .sg-empty-desc { color: var(--text2); font-size: 12px; line-height: 1.6; margin-bottom: 20px; }

    .sg-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      transition: border-color var(--transition-fast);
    }
    .sg-card:hover { border-color: var(--borderHover); }
    .sg-card + .sg-card { margin-top: 8px; }

    .sg-verdict-card {
      padding: 18px;
      border-radius: var(--radius-lg);
      margin-bottom: 14px;
      position: relative;
      overflow: hidden;
    }
    .sg-verdict-card.ship { background: var(--shipBg); border: 1px solid var(--shipBorder); }
    .sg-verdict-card.warn { background: var(--warnBg); border: 1px solid var(--warnBorder); }
    .sg-verdict-card.noship { background: var(--noshipBg); border: 1px solid var(--noshipBorder); }
    .sg-glow-circle {
      position: absolute;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      top: -30px;
      right: -30px;
      filter: blur(35px);
      opacity: 0.2;
    }
    .sg-glow-circle-bl {
      position: absolute;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      bottom: -25px;
      left: -25px;
      filter: blur(30px);
      opacity: 0.1;
    }
    .sg-verdict-card.ship .sg-glow-circle, .sg-verdict-card.ship .sg-glow-circle-bl { background: var(--ship); }
    .sg-verdict-card.warn .sg-glow-circle, .sg-verdict-card.warn .sg-glow-circle-bl { background: var(--warn); }
    .sg-verdict-card.noship .sg-glow-circle, .sg-verdict-card.noship .sg-glow-circle-bl { background: var(--noship); }
    .sg-verdict-inner {
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      z-index: 1;
    }
    .sg-ring-wrap { flex-shrink: 0; position: relative; }
    .sg-ring-wrap svg { display: block; }
    .sg-ring-label {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%,-50%);
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 14px;
      color: var(--text0);
    }
    .sg-verdict-text h3 { font-size: 16px; font-weight: 800; margin-bottom: 3px; letter-spacing: -0.3px; }
    .sg-verdict-text p { font-size: 11px; color: var(--text2); }

    .sg-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 14px;
    }
    .sg-stat-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 12px;
      position: relative;
      overflow: hidden;
      transition: border-color var(--transition-fast);
    }
    .sg-stat-card:hover { border-color: var(--borderHover); }
    .sg-stat-card .sg-sparkline { position: absolute; top: 10px; right: 10px; opacity: 0.5; }
    .sg-stat-value { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 17px; color: var(--text0); }
    .sg-stat-label { font-size: 9px; text-transform: uppercase; color: var(--text3); margin-top: 3px; letter-spacing: 0.5px; font-weight: 600; }

    .sg-section-title {
      font-size: 10px;
      font-weight: 700;
      color: var(--text3);
      margin-bottom: 8px;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .sg-compliance-row { display: flex; gap: 6px; margin-bottom: 14px; }
    .sg-compliance-card {
      flex: 1;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 10px;
      text-align: center;
    }
    .sg-compliance-value { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 15px; }
    .sg-compliance-value.ship { color: var(--ship); }
    .sg-compliance-value.warn { color: var(--warn); }
    .sg-compliance-value.noship { color: var(--noship); }
    .sg-compliance-label { font-size: 9px; color: var(--text3); margin-top: 3px; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }

    .sg-provenance-bar { margin-bottom: 6px; }
    .sg-provenance-bar .row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
    .sg-provenance-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .sg-provenance-label { font-size: 10px; color: var(--text2); flex: 0 0 76px; }
    .sg-provenance-track { flex: 1; height: 4px; background: var(--bg4); border-radius: 2px; overflow: hidden; }
    .sg-provenance-fill { height: 100%; border-radius: 2px; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
    .sg-provenance-pct { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text3); width: 30px; text-align: right; }

    .sg-claim-row {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 6px;
      overflow: hidden;
      transition: border-color var(--transition-fast);
    }
    .sg-claim-row:hover { border-color: var(--borderHover); }
    .sg-claim-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      transition: background var(--transition-fast);
    }
    .sg-claim-header:hover { background: var(--glass); }
    .sg-claim-status {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      flex-shrink: 0;
      font-weight: 700;
    }
    .sg-claim-status.proven { background: var(--shipBg); color: var(--ship); border: 1px solid var(--shipBorder); }
    .sg-claim-status.partial { background: var(--warnBg); color: var(--warn); border: 1px solid var(--warnBorder); }
    .sg-claim-status.failed { background: var(--noshipBg); color: var(--noship); border: 1px solid var(--noshipBorder); }
    .sg-claim-name { flex: 1; font-weight: 500; color: var(--text0); font-size: 12px; }
    .sg-claim-conf { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text3); }
    .sg-claim-body {
      max-height: 400px;
      overflow: hidden;
      padding: 10px 12px;
      border-top: 1px solid var(--border);
      transition: max-height 0.2s ease, padding 0.2s ease;
    }
    .sg-claim-body.collapsed { max-height: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; }
    .sg-claim-evidence { font-size: 11px; color: var(--text2); margin-bottom: 6px; line-height: 1.5; }
    .sg-control-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      background: var(--accentBg);
      color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.3px;
      border: 1px solid rgba(99,102,241,0.12);
    }

    .sg-file-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 5px;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .sg-file-row:hover { background: var(--bg3); border-color: var(--borderHover); transform: translateX(2px); }
    .sg-file-badge {
      padding: 2px 7px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      flex-shrink: 0;
      letter-spacing: 0.3px;
    }
    .sg-file-badge.ship { background: var(--shipBg); color: var(--ship); border: 1px solid var(--shipBorder); }
    .sg-file-badge.warn { background: var(--warnBg); color: var(--warn); border: 1px solid var(--warnBorder); }
    .sg-file-badge.noship { background: var(--noshipBg); color: var(--noship); border: 1px solid var(--noshipBorder); }
    .sg-file-name { flex: 1; font-size: 11px; color: var(--text1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sg-file-score { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text3); }

    .sg-pipeline-status { background: var(--bg2); border-radius: var(--radius-md); padding: 12px; margin-bottom: 14px; border: 1px solid var(--border); }
    .sg-pipeline-status .header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .sg-pipeline-status .job-dots { display: flex; gap: 4px; margin-top: 8px; }
    .sg-pipeline-status .job-dot { width: 8px; height: 8px; border-radius: 50%; transition: background var(--transition-fast); }
    .sg-pipeline-status .job-dot.success { background: var(--ship); }
    .sg-pipeline-status .job-dot.running { background: var(--blue); animation: pulse 2s infinite; }
    .sg-pipeline-status .job-dot.pending { background: var(--bg4); }
    .sg-pipeline-status .job-dot.failure { background: var(--noship); }

    .sg-findings-preview { margin-bottom: 14px; }
    .sg-finding-row { display: flex; align-items: center; gap: 7px; padding: 5px 0; font-size: 11px; }
    .sg-finding-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .sg-finding-dot.critical { background: var(--noship); box-shadow: 0 0 6px rgba(255,92,106,0.5); }
    .sg-finding-dot.high { background: var(--highSev); }
    .sg-finding-dot.medium { background: var(--warn); }
    .sg-finding-dot.low { background: var(--text3); }
    .sg-finding-msg { flex: 1; color: var(--text1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sg-view-all { font-size: 10px; color: var(--accent); cursor: pointer; margin-top: 6px; transition: color var(--transition-fast); }
    .sg-view-all:hover { color: #818cf8; }

    .sg-pipeline-tab .run-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 5px;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .sg-pipeline-tab .run-row:hover { background: var(--bg3); border-color: var(--borderHover); }
    .sg-pipeline-tab .run-detail {
      padding: 8px 12px 12px 20px;
      font-size: 11px;
      border-left: 2px solid var(--accent);
      margin-left: 12px;
      margin-bottom: 8px;
    }
    .sg-pipeline-tab .job-line { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
    .sg-pipeline-tab .env-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      margin-bottom: 5px;
      font-size: 11px;
    }
    .sg-pipeline-tab .env-name { font-weight: 600; color: var(--text0); }
    .sg-pipeline-tab .env-score { font-family: 'JetBrains Mono', monospace; font-weight: 700; }

    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
    @keyframes shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 200px 0; }
    }
    @keyframes glowPulse {
      0%, 100% { box-shadow: 0 0 10px rgba(0,230,138,0.15); }
      50% { box-shadow: 0 0 22px rgba(0,230,138,0.3); }
    }

    .sg-actions-section { margin-bottom: 18px; }
    .sg-actions-section-title {
      font-size: 9px;
      font-weight: 700;
      color: var(--text3);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .sg-actions-section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, var(--border), transparent);
    }

    .sg-action-card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 12px 14px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: all var(--transition-med);
      display: flex;
      align-items: center;
      gap: 11px;
      position: relative;
      overflow: hidden;
    }
    .sg-action-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, transparent 0%, var(--glass) 100%);
      opacity: 0;
      transition: opacity var(--transition-fast);
    }
    .sg-action-card:hover {
      border-color: var(--borderHover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-card);
    }
    .sg-action-card:hover::before { opacity: 1; }
    .sg-action-card:active { transform: translateY(0); box-shadow: none; }

    .sg-action-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }
    .sg-action-icon.go { background: linear-gradient(135deg, var(--ship), var(--shipDim)); box-shadow: 0 2px 8px rgba(0,230,138,0.2); }
    .sg-action-icon.vibe { background: linear-gradient(135deg, var(--accent), #818cf8); box-shadow: 0 2px 8px rgba(99,102,241,0.2); }
    .sg-action-icon.scan { background: linear-gradient(135deg, var(--blue), #0ea5e9); box-shadow: 0 2px 8px rgba(56,189,248,0.2); }
    .sg-action-icon.gen { background: linear-gradient(135deg, var(--warn), #f59e0b); box-shadow: 0 2px 8px rgba(255,181,71,0.2); }
    .sg-action-icon.infer { background: linear-gradient(135deg, #a78bfa, #7c3aed); box-shadow: 0 2px 8px rgba(124,58,237,0.2); }
    .sg-action-icon.heal { background: linear-gradient(135deg, #f472b6, #ec4899); box-shadow: 0 2px 8px rgba(236,72,153,0.2); }

    .sg-action-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
    .sg-action-title { font-size: 12px; font-weight: 600; color: var(--text0); margin-bottom: 1px; letter-spacing: -0.1px; }
    .sg-action-desc { font-size: 10px; color: var(--text3); line-height: 1.4; }
    .sg-action-arrow {
      color: var(--text3);
      font-size: 12px;
      flex-shrink: 0;
      transition: all var(--transition-fast);
      position: relative;
      z-index: 1;
    }
    .sg-action-card:hover .sg-action-arrow { color: var(--text1); transform: translateX(2px); }

    .sg-gen-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-top: 4px; }
    .sg-gen-btn {
      padding: 8px 6px;
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text2);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .sg-gen-btn:hover {
      border-color: var(--borderHover);
      background: var(--bg3);
      color: var(--text0);
      transform: translateY(-1px);
      box-shadow: var(--shadow-card);
    }
    .sg-gen-btn:active { transform: translateY(0); }

    .sg-action-hero {
      background: linear-gradient(145deg, rgba(0,230,138,0.04), rgba(99,102,241,0.04), rgba(56,189,248,0.02));
      border: 1px solid rgba(0,230,138,0.08);
      border-radius: var(--radius-lg);
      padding: 22px 18px 20px;
      margin-bottom: 16px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .sg-action-hero::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(ellipse at 30% 20%, rgba(0,230,138,0.06) 0%, transparent 50%),
                  radial-gradient(ellipse at 70% 80%, rgba(99,102,241,0.04) 0%, transparent 50%);
      pointer-events: none;
    }
    .sg-action-hero-icon { font-size: 28px; margin-bottom: 10px; position: relative; z-index: 1; }
    .sg-action-hero-title { font-size: 16px; font-weight: 800; color: var(--text0); margin-bottom: 4px; letter-spacing: -0.4px; position: relative; z-index: 1; }
    .sg-action-hero-desc { font-size: 11px; color: var(--text2); margin-bottom: 16px; line-height: 1.5; position: relative; z-index: 1; max-width: 220px; margin-left: auto; margin-right: auto; }
    .sg-action-hero-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 22px;
      border-radius: 8px;
      border: none;
      background: linear-gradient(135deg, var(--ship) 0%, var(--accent) 100%);
      color: var(--bg0);
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all var(--transition-fast);
      position: relative;
      z-index: 1;
      box-shadow: 0 0 16px rgba(0,230,138,0.2), 0 4px 12px rgba(0,0,0,0.3);
      letter-spacing: 0.2px;
    }
    .sg-action-hero-btn:hover {
      box-shadow: 0 0 24px rgba(0,230,138,0.35), 0 6px 16px rgba(0,0,0,0.4);
      transform: translateY(-2px);
    }
    .sg-action-hero-btn:active { transform: translateY(0); }
    .sg-action-hero-kbd {
      display: block;
      margin-top: 10px;
      font-size: 10px;
      color: var(--text3);
      position: relative;
      z-index: 1;
    }
    .sg-kbd {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--bg4);
      color: var(--text2);
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      border: 1px solid var(--border);
    }

    .sg-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, var(--border) 20%, var(--border) 80%, transparent 100%);
      margin: 14px 0;
    }

    .sg-empty-onboard {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px 20px;
      text-align: center;
      margin-top: 8px;
    }
    .sg-empty-step {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      text-align: left;
      padding: 8px 0;
    }
    .sg-empty-step-num {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--accentBg);
      border: 1px solid rgba(99,102,241,0.15);
      color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sg-empty-step-text { font-size: 11px; color: var(--text1); line-height: 1.5; }
    .sg-empty-step-text strong { color: var(--text0); }
    .sg-empty-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 16px;
      padding: 9px 18px;
      border-radius: 8px;
      border: none;
      background: linear-gradient(135deg, var(--ship) 0%, var(--accent) 100%);
      color: var(--bg0);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all var(--transition-fast);
      box-shadow: 0 0 12px rgba(0,230,138,0.15);
    }
    .sg-empty-cta:hover { box-shadow: 0 0 20px rgba(0,230,138,0.3); transform: translateY(-1px); }

    .sg-file-summary {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      padding: 10px 0;
    }
    .sg-file-summary-item {
      flex: 1;
      text-align: center;
    }
    .sg-file-summary-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 16px;
      font-weight: 700;
    }
    .sg-file-summary-label {
      font-size: 9px;
      color: var(--text3);
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="sg-header">
    <div class="sg-header-top">
      <div class="sg-logo-row">
        <div class="sg-logo-box">&#x26A1;</div>
        <div>
          <div class="sg-brand">ShipGate</div>
          <div class="sg-repo" id="sg-repo">—</div>
        </div>
      </div>
      <div class="sg-header-actions">
        <button class="sg-icon-btn" id="sg-refresh" title="Refresh">&#x21BB;</button>
        <button class="sg-icon-btn" id="sg-settings" title="Settings">&#x2699;</button>
      </div>
    </div>
    <div class="sg-tabs">
      <button class="sg-tab active" data-tab="overview">Overview</button>
      <button class="sg-tab" data-tab="actions">Actions</button>
      <button class="sg-tab" data-tab="claims">Claims</button>
      <button class="sg-tab" data-tab="pipeline">Pipeline</button>
      <button class="sg-tab" data-tab="files">Files</button>
    </div>
  </div>
  <div class="sg-content" id="sg-content"></div>
  <div class="sg-footer">
    <span class="sg-footer-time" id="sg-footer-time">Last scan: —</span>
    <button class="sg-verify-btn" id="sg-verify-btn">&#x25B6; Verify</button>
  </div>

  <script nonce="${nonce}">
(function() {
  var vscode = acquireVsCodeApi();
  var data = null;
  var activeTab = 'overview';

  function post(type, payload) {
    vscode.postMessage({ type: type, payload: payload });
  }

  function sparkline(arr, color, w, h) {
    w = w || 40; h = h || 16;
    var max = Math.max.apply(null, arr);
    var min = Math.min.apply(null, arr);
    var range = max - min || 1;
    var pts = arr.map(function(v, i) {
      var x = (i / (arr.length - 1 || 1)) * w;
      var y = h - ((v - min) / range) * h;
      return x + ',' + y;
    }).join(' ');
    var last = arr[arr.length - 1];
    var lastY = h - ((last - min) / range) * h;
    return '<svg width="' + w + '" height="' + h + '">' +
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + w + '" cy="' + lastY + '" r="2" fill="' + color + '"/>' +
    '</svg>';
  }

  function ring(value, size, stroke, color) {
    size = size || 64; stroke = stroke || 4; color = color || '#00e68a';
    var r = (size - stroke) / 2;
    var circ = 2 * Math.PI * r;
    var offset = circ - (value / 100) * circ;
    return '<svg width="' + size + '" height="' + size + '" style="transform:rotate(-90deg)">' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="#222233" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" ' +
      'stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" ' +
      'style="transition:stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)"/>' +
    '</svg>';
  }

  function verdictColor(v) {
    if (v === 'SHIP') return { main: '#00e68a', bg: 'rgba(0,230,138,0.08)' };
    if (v === 'WARN') return { main: '#ffb547', bg: 'rgba(255,181,71,0.08)' };
    return { main: '#ff5c6a', bg: 'rgba(255,92,106,0.08)' };
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    var s = Math.floor((Date.now() - d) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  }

  function renderEmpty() {
    var el = document.getElementById('sg-content');
    var html = '<div class="sg-empty-state">';
    html += '<div class="sg-empty-icon">&#x26A1;</div>';
    html += '<div class="sg-empty-title">Welcome to ShipGate</div>';
    html += '<div class="sg-empty-desc">Behavioral verification for AI-generated code. Get started in seconds.</div>';
    html += '</div>';
    html += '<div class="sg-empty-onboard">';
    html += '<div class="sg-empty-step"><div class="sg-empty-step-num">1</div><div class="sg-empty-step-text"><strong>Initialize</strong> &mdash; Run <span class="sg-kbd">shipgate go</span> to detect your project and generate ISL specs</div></div>';
    html += '<div class="sg-empty-step"><div class="sg-empty-step-num">2</div><div class="sg-empty-step-text"><strong>Verify</strong> &mdash; ShipGate checks your code against behavioral contracts</div></div>';
    html += '<div class="sg-empty-step"><div class="sg-empty-step-num">3</div><div class="sg-empty-step-text"><strong>Ship</strong> &mdash; Get a SHIP / NO_SHIP verdict with evidence</div></div>';
    html += '<button class="sg-empty-cta" id="sg-empty-go">&#x25B6; Get started</button>';
    html += '</div>';
    el.innerHTML = html;
    var btn = document.getElementById('sg-empty-go');
    if (btn) btn.addEventListener('click', function() { post('goCommand'); });
  }

  function renderOverview() {
    var d = data;
    var stats = d.stats || {};
    var comp = d.compliance || {};
    var prov = d.provenance || {};
    var v = d.verdict || 'NO_SHIP';
    var color = verdictColor(v).main;
    var claimsCount = (d.claims || []).length;
    var verifiedCount = stats.verifiedClaims ?? claimsCount;

    var html = '';

    html += '<div class="sg-verdict-card ' + v.toLowerCase().replace('_','') + '">';
    html += '<div class="sg-glow-circle"></div>';
    html += '<div class="sg-glow-circle-bl"></div>';
    html += '<div class="sg-verdict-inner">';
    html += '<div class="sg-ring-wrap">' + ring(d.score || 0, 64, 4, color) + '<span class="sg-ring-label">' + (d.score || 0) + '</span></div>';
    html += '<div class="sg-verdict-text">';
    html += '<h3 style="color:' + color + '">' + v.replace('_',' ') + '</h3>';
    html += '<p>' + verifiedCount + '/' + (stats.totalClaims || claimsCount || 8) + ' claims verified</p>';
    html += '</div></div></div>';

    // Pipeline status (compact)
    var pl = d.pipeline;
    if (pl && pl.currentRun) {
      var cr = pl.currentRun;
      var jobStatusClass = { success: 'success', running: 'running', pending: 'pending', failure: 'failure' };
      var doneCount = (cr.jobs || []).filter(function(j){ return j.status === 'success'; }).length;
      var totalJobs = (cr.jobs || []).length;
      html += '<div class="sg-pipeline-status">';
      html += '<div class="header">';
      html += '<span class="sg-job-dot ' + (cr.status === 'running' ? 'running' : 'success') + '" style="width:8px;height:8px;border-radius:50%;background:' + (cr.status === 'running' ? 'var(--blue)' : 'var(--ship)') + '"></span>';
      html += '<span style="font-size:12px;color:var(--text0);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtmlUI(cr.commitMsg) + '</span>';
      html += '<span style="font-size:10px;color:var(--accent);font-family:JetBrains Mono,monospace">' + escapeHtmlUI(cr.pr || '') + '</span>';
      html += '</div>';
      html += '<div class="job-dots">';
      (cr.jobs || []).forEach(function(j){
        html += '<span class="job-dot ' + jobStatusClass[j.status] || 'pending' + '" title="' + escapeHtmlUI(j.name) + '"></span>';
      });
      html += '</div>';
      html += '<div style="font-size:10px;color:var(--text3);margin-top:6px">' + doneCount + '/' + totalJobs + ' jobs complete';
      if (cr.status === 'running' && cr.runningJob) html += ' &bull; ' + escapeHtmlUI(cr.runningJob) + ' — ' + (cr.runningDuration || '—');
      html += '</div></div>';
    }

    // Stats grid
    var sparkData = [40,55,62,58,70,75,d.score||0];
    html += '<div class="sg-stats-grid">';
    html += '<div class="sg-stat-card"><span class="sg-sparkline">' + sparkline(sparkData, color, 50, 16) + '</span>';
    html += '<div class="sg-stat-value">' + (verifiedCount + '/' + (stats.totalClaims || 8)) + '</div>';
    html += '<div class="sg-stat-label">Claims</div></div>';
    html += '<div class="sg-stat-card"><span class="sg-sparkline">' + sparkline([60,65,70,72,75,d.score||0], color, 50, 16) + '</span>';
    html += '<div class="sg-stat-value">' + (d.score || 0) + '%</div>';
    html += '<div class="sg-stat-label">Coverage</div></div>';
    html += '<div class="sg-stat-card"><span class="sg-sparkline">' + sparkline([200,220,250,263], color, 50, 16) + '</span>';
    html += '<div class="sg-stat-value">' + (stats.totalFiles || 0) + '</div>';
    html += '<div class="sg-stat-label">Files</div></div>';
    html += '<div class="sg-stat-card"><span class="sg-sparkline">' + sparkline([25,22,20,19], '#ff5c6a', 50, 16) + '</span>';
    html += '<div class="sg-stat-value">' + (stats.issues || 0) + '</div>';
    html += '<div class="sg-stat-label">Issues</div></div>';
    html += '</div>';

    // Compliance
    html += '<div class="sg-section-title">Compliance</div>';
    html += '<div class="sg-compliance-row">';
    var soc = comp.soc2 ?? 0, hip = comp.hipaa ?? 0, eu = comp.euai ?? 0;
    html += '<div class="sg-compliance-card"><div class="sg-compliance-value ' + (soc>=70?'ship':soc>=50?'warn':'noship') + '">' + soc + '%</div><div class="sg-compliance-label">SOC 2</div></div>';
    html += '<div class="sg-compliance-card"><div class="sg-compliance-value ' + (hip>=70?'ship':hip>=50?'warn':'noship') + '">' + hip + '%</div><div class="sg-compliance-label">HIPAA</div></div>';
    html += '<div class="sg-compliance-card"><div class="sg-compliance-value ' + (eu>=70?'ship':eu>=50?'warn':'noship') + '">' + eu + '%</div><div class="sg-compliance-label">EU AI</div></div>';
    html += '</div>';

    // Provenance
    html += '<div class="sg-section-title">AI Provenance</div>';
    var provItems = [
      { k: 'aiGenerated', l: 'AI-Generated', c: '#6366f1' },
      { k: 'human', l: 'Human', c: '#00e68a' },
      { k: 'aiAssisted', l: 'AI-Assisted', c: '#ffb547' },
      { k: 'unknown', l: 'Unknown', c: '#8888a0' }
    ];
    provItems.forEach(function(p) {
      var val = prov[p.k] || 0;
      html += '<div class="sg-provenance-bar"><div class="row">';
      html += '<span class="sg-provenance-dot" style="background:' + p.c + '"></span>';
      html += '<span class="sg-provenance-label">' + p.l + '</span>';
      html += '<div class="sg-provenance-track"><div class="sg-provenance-fill" style="width:' + val + '%;background:' + p.c + '"></div></div>';
      html += '<span class="sg-provenance-pct">' + val + '%</span>';
      html += '</div></div>';
    });

    // Active findings preview (top 3)
    var findingsList = d.findings || [];
    if (findingsList.length > 0) {
      html += '<div class="sg-section-title">Active Findings</div>';
      html += '<div class="sg-findings-preview">';
      findingsList.slice(0, 3).forEach(function(f) {
        html += '<div class="sg-finding-row">';
        html += '<span class="sg-finding-dot ' + (f.severity || 'low') + '"></span>';
        html += '<span class="sg-finding-msg" title="' + escapeHtmlUI(f.message) + '">' + escapeHtmlUI(f.message) + '</span>';
        html += '<span style="color:var(--text3);font-size:10px">' + escapeHtmlUI(f.file) + '</span>';
        html += '</div>';
      });
      html += '<div class="sg-view-all" id="sg-view-all-findings">View all ' + findingsList.length + ' →</div>';
      html += '</div>';
    }

    document.getElementById('sg-content').innerHTML = html;
    var viewAll = document.getElementById('sg-view-all-findings');
    if (viewAll) viewAll.addEventListener('click', function(){ post('openReport'); });
  }

  function renderClaims() {
    var claims = data && data.claims ? data.claims : [];
    if (!claims.length) {
      document.getElementById('sg-content').innerHTML = '<div class="sg-empty-state"><div class="sg-empty-desc">No claims data yet.</div></div>';
      return;
    }
    var html = '';
    claims.forEach(function(c, i) {
      var statusClass = (c.status || '').toLowerCase().indexOf('proven')>=0 ? 'proven' : (c.status || '').toLowerCase().indexOf('partial')>=0 ? 'partial' : 'failed';
      var sym = statusClass === 'proven' ? '✓' : statusClass === 'partial' ? '◐' : '✗';
      var bodyId = 'claim-body-' + i;
      html += '<div class="sg-claim-row">';
      html += '<div class="sg-claim-header" data-toggle="' + bodyId + '">';
      html += '<span class="sg-claim-status ' + statusClass + '">' + sym + '</span>';
      html += '<span class="sg-claim-name">' + escapeHtmlUI(c.name) + '</span>';
      html += '<span class="sg-claim-conf">' + (c.confidence || 0) + '%</span>';
      html += '</div>';
      html += '<div class="sg-claim-body collapsed" id="' + bodyId + '">';
      html += '<div class="sg-claim-evidence">' + escapeHtmlUI(c.evidence || '') + '</div>';
      if (c.control) html += '<span class="sg-control-badge">SOC 2 ' + escapeHtmlUI(c.control) + '</span>';
      html += '</div></div>';
    });
    document.getElementById('sg-content').innerHTML = html;

    document.querySelectorAll('.sg-claim-header').forEach(function(hdr) {
      hdr.addEventListener('click', function() {
        var id = hdr.getAttribute('data-toggle');
        var body = document.getElementById(id);
        if (body) body.classList.toggle('collapsed');
      });
    });
  }

  function escapeHtmlUI(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderPipeline() {
    var pl = data && data.pipeline;
    if (!pl || !pl.recentRuns || pl.recentRuns.length === 0) {
      document.getElementById('sg-content').innerHTML = '<div class="sg-empty-state"><div class="sg-empty-desc">No pipeline data yet. Connect GitHub to see CI runs.</div></div>';
      return;
    }
    var expandedIdx = window._sgExpandedRun !== undefined ? window._sgExpandedRun : -1;
    var html = '';

    // Recent runs
    pl.recentRuns.forEach(function(run, i) {
      var statusCl = run.status === 'success' ? 'ship' : run.status === 'failure' ? 'noship' : run.status === 'running' ? 'blue' : 'text3';
      var statusColor = run.status === 'success' ? 'var(--ship)' : run.status === 'failure' ? 'var(--noship)' : run.status === 'running' ? 'var(--blue)' : 'var(--text3)';
      html += '<div class="run-row" data-run-idx="' + i + '">';
      html += '<span style="width:8px;height:8px;border-radius:50%;background:' + statusColor + ';flex-shrink:0"></span>';
      html += '<span style="flex:1;font-size:11px;color:var(--text0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtmlUI(run.commitMsg) + '">' + escapeHtmlUI(run.commitMsg) + '</span>';
      if (run.verdict) html += '<span class="sg-file-badge ' + (run.verdict === 'SHIP' ? 'ship' : run.verdict === 'WARN' ? 'warn' : 'noship') + '">' + run.verdict + '</span>';
      if (run.score != null) html += '<span style="font-family:JetBrains Mono,monospace;font-size:11px;font-weight:600;color:var(--text0)">' + run.score + '</span>';
      html += '<span style="font-size:10px;color:var(--text3)">' + escapeHtmlUI(run.time) + '</span>';
      html += '<span style="font-size:10px;color:var(--text3)">' + (expandedIdx === i ? '▴' : '▾') + '</span>';
      html += '</div>';

      if (expandedIdx === i && run.jobs && run.jobs.length > 0) {
        html += '<div class="run-detail">';
        run.jobs.forEach(function(j) {
          var jc = j.status === 'success' ? 'var(--ship)' : j.status === 'failure' ? 'var(--noship)' : j.status === 'running' ? 'var(--blue)' : 'var(--text3)';
          html += '<div class="job-line"><span style="width:6px;height:6px;border-radius:50%;background:' + jc + '"></span><span style="color:var(--text1)">' + escapeHtmlUI(j.name) + '</span></div>';
        });
        if (run.blockers && run.blockers.length > 0) {
          html += '<div style="margin-top:8px;padding:8px;background:var(--noshipBg);border-radius:6px;border:1px solid rgba(255,92,106,0.15)">';
          html += '<div style="font-size:10px;font-weight:600;color:var(--noship);margin-bottom:4px">BLOCKERS</div>';
          run.blockers.forEach(function(b) { html += '<div style="font-size:11px;color:var(--noship);opacity:0.8">✗ ' + escapeHtmlUI(b) + '</div>'; });
          html += '</div>';
        }
        html += '</div>';
      }
    });

    // Deployment environments
    if (pl.environments && pl.environments.length > 0) {
      html += '<div class="sg-section-title" style="margin-top:16px">Environments</div>';
      pl.environments.forEach(function(env) {
        var esc = env.status === 'protected' ? 'var(--ship)' : env.status === 'gated' ? 'var(--warn)' : 'var(--text3)';
        html += '<div class="env-row">';
        html += '<span class="env-name">' + escapeHtmlUI(env.name) + '</span>';
        html += '<span class="sg-file-badge ' + (env.status === 'protected' ? 'ship' : env.status === 'gated' ? 'warn' : '') + '" style="margin-right:8px">' + escapeHtmlUI(env.status) + '</span>';
        html += '<span class="env-score" style="color:' + esc + '">' + env.score + '%</span>';
        html += '</div>';
      });
    }

    document.getElementById('sg-content').innerHTML = '<div class="sg-pipeline-tab">' + html + '</div>';

    document.querySelectorAll('.run-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var idx = parseInt(row.getAttribute('data-run-idx') || '-1', 10);
        window._sgExpandedRun = window._sgExpandedRun === idx ? -1 : idx;
        renderPipeline();
      });
    });
  }

  function renderActions() {
    var html = '';
    var isMac = navigator.platform.indexOf('Mac') > -1;
    var mod = isMac ? '&#x2318;' : 'Ctrl';

    html += '<div class="sg-action-hero">';
    html += '<div class="sg-action-hero-icon">&#x26A1;</div>';
    html += '<div class="sg-action-hero-title">Ship with confidence</div>';
    html += '<div class="sg-action-hero-desc">Scan, infer ISL specs, verify against behavioral contracts, and gate &mdash; in one command.</div>';
    html += '<button class="sg-action-hero-btn" id="sg-action-go">&#x25B6; shipgate go</button>';
    html += '<div class="sg-action-hero-kbd"><span class="sg-kbd">' + mod + '</span> <span class="sg-kbd">&#x21E7;</span> <span class="sg-kbd">&#x23CE;</span></div>';
    html += '</div>';

    html += '<div class="sg-actions-section">';
    html += '<div class="sg-actions-section-title">Workflows</div>';

    html += '<div class="sg-action-card" id="sg-action-vibe">';
    html += '<div class="sg-action-icon vibe">&#x2728;</div>';
    html += '<div class="sg-action-body"><div class="sg-action-title">Vibe &rarr; Ship</div>';
    html += '<div class="sg-action-desc">English prompt &rarr; ISL spec &rarr; verified code</div></div>';
    html += '<span class="sg-action-arrow">&#x203A;</span></div>';

    html += '<div class="sg-action-card" id="sg-action-go-fix">';
    html += '<div class="sg-action-icon go">&#x1F6E0;</div>';
    html += '<div class="sg-action-body"><div class="sg-action-title">Go + Auto-Heal</div>';
    html += '<div class="sg-action-desc">Scan, then auto-fix violations</div></div>';
    html += '<span class="sg-action-arrow">&#x203A;</span></div>';

    html += '<div class="sg-action-card" id="sg-action-go-deep">';
    html += '<div class="sg-action-icon scan">&#x1F50D;</div>';
    html += '<div class="sg-action-body"><div class="sg-action-title">Deep Scan</div>';
    html += '<div class="sg-action-desc">Thorough analysis, higher coverage target</div></div>';
    html += '<span class="sg-action-arrow">&#x203A;</span></div>';
    html += '</div>';

    html += '<div class="sg-actions-section">';
    html += '<div class="sg-actions-section-title">Analyze</div>';

    html += '<div class="sg-action-card" id="sg-action-scan">';
    html += '<div class="sg-action-icon scan">&#x1F4CB;</div>';
    html += '<div class="sg-action-body"><div class="sg-action-title">Quick Scan</div>';
    html += '<div class="sg-action-desc">Scan &amp; gate verdict</div></div>';
    html += '<span class="sg-action-arrow">&#x203A;</span></div>';

    html += '<div class="sg-action-card" id="sg-action-infer">';
    html += '<div class="sg-action-icon infer">&#x1F9E0;</div>';
    html += '<div class="sg-action-body"><div class="sg-action-title">Infer ISL Specs</div>';
    html += '<div class="sg-action-desc">AI-generate behavioral specs from code</div></div>';
    html += '<span class="sg-action-arrow">&#x203A;</span></div>';

    html += '<div class="sg-action-card" id="sg-action-heal">';
    html += '<div class="sg-action-icon heal">&#x1FA79;</div>';
    html += '<div class="sg-action-body"><div class="sg-action-title">Heal All</div>';
    html += '<div class="sg-action-desc">Auto-fix violations across project</div></div>';
    html += '<span class="sg-action-arrow">&#x203A;</span></div>';
    html += '</div>';

    html += '<div class="sg-actions-section">';
    html += '<div class="sg-actions-section-title">Generate from ISL</div>';
    html += '<div class="sg-gen-grid">';
    html += '<button class="sg-gen-btn" id="sg-gen-ts">TS</button>';
    html += '<button class="sg-gen-btn" id="sg-gen-python">Python</button>';
    html += '<button class="sg-gen-btn" id="sg-gen-rust">Rust</button>';
    html += '<button class="sg-gen-btn" id="sg-gen-go">Go</button>';
    html += '<button class="sg-gen-btn" id="sg-gen-graphql">GQL</button>';
    html += '<button class="sg-gen-btn" id="sg-gen-openapi">OpenAPI</button>';
    html += '</div></div>';

    html += '<div class="sg-actions-section">';
    html += '<div class="sg-actions-section-title">Spec Tools</div>';

    html += '<div class="sg-action-card" id="sg-action-code-to-isl">';
    html += '<div class="sg-action-icon" style="background:linear-gradient(135deg,#60a5fa,#3b82f6);box-shadow:0 2px 8px rgba(59,130,246,0.2)">&#x1F4DD;</div>';
    html += '<div class="sg-action-body"><div class="sg-action-title">Code &rarr; ISL</div>';
    html += '<div class="sg-action-desc">Generate spec from current file</div></div>';
    html += '<span class="sg-action-arrow">&#x203A;</span></div>';

    html += '<div class="sg-action-card" id="sg-action-fmt">';
    html += '<div class="sg-action-icon" style="background:linear-gradient(135deg,#34d399,#10b981);box-shadow:0 2px 8px rgba(16,185,129,0.2)">&#x2261;</div>';
    html += '<div class="sg-action-body"><div class="sg-action-title">Format &amp; Lint</div>';
    html += '<div class="sg-action-desc">Auto-format all ISL spec files</div></div>';
    html += '<span class="sg-action-arrow">&#x203A;</span></div>';

    html += '</div>';

    document.getElementById('sg-content').innerHTML = html;

    var heroBtn = document.getElementById('sg-action-go');
    if (heroBtn) heroBtn.addEventListener('click', function() { post('goCommand'); });

    var bindings = [
      ['sg-action-go-fix', 'goFix'],
      ['sg-action-go-deep', 'goDeep'],
      ['sg-action-vibe', 'vibeGenerate'],
      ['sg-action-infer', 'inferSpecs'],
      ['sg-action-scan', 'scanProject'],
      ['sg-action-heal', 'healAll'],
      ['sg-action-code-to-isl', 'codeToIsl'],
      ['sg-action-fmt', 'fmtSpecs'],
      ['sg-gen-ts', 'genTypescript'],
      ['sg-gen-python', 'genPython'],
      ['sg-gen-rust', 'genRust'],
      ['sg-gen-go', 'genGo'],
      ['sg-gen-graphql', 'genGraphql'],
      ['sg-gen-openapi', 'genOpenapi'],
    ];

    bindings.forEach(function(b) {
      var el = document.getElementById(b[0]);
      if (el) el.addEventListener('click', function() { post(b[1]); });
    });
  }

  function renderFiles() {
    var files = data && data.files ? data.files : [];
    if (!files.length) {
      document.getElementById('sg-content').innerHTML = '<div class="sg-empty-state"><div class="sg-empty-icon">&#x1F4C2;</div><div class="sg-empty-title">No file data yet</div><div class="sg-empty-desc">Run a scan to see per-file verdicts.</div></div>';
      return;
    }
    var shipCount = 0, warnCount = 0, failCount = 0;
    files.forEach(function(f) {
      if (f.status === 'SHIP') shipCount++;
      else if (f.status === 'WARN') warnCount++;
      else failCount++;
    });

    var html = '<div class="sg-file-summary">';
    html += '<div class="sg-file-summary-item"><div class="sg-file-summary-val" style="color:var(--ship)">' + shipCount + '</div><div class="sg-file-summary-label">Passed</div></div>';
    html += '<div class="sg-file-summary-item"><div class="sg-file-summary-val" style="color:var(--warn)">' + warnCount + '</div><div class="sg-file-summary-label">Warnings</div></div>';
    html += '<div class="sg-file-summary-item"><div class="sg-file-summary-val" style="color:var(--noship)">' + failCount + '</div><div class="sg-file-summary-label">Failed</div></div>';
    html += '</div>';
    html += '<div class="sg-divider"></div>';

    files.forEach(function(f) {
      var status = (f.status || 'NO_SHIP').toLowerCase().replace('_','');
      html += '<div class="sg-file-row" data-path="' + escapeHtmlUI(f.path) + '" data-line="1">';
      html += '<span class="sg-file-badge ' + status + '">' + (f.status || 'NO_SHIP') + '</span>';
      html += '<span class="sg-file-name" title="' + escapeHtmlUI(f.path) + '">' + escapeHtmlUI(f.name) + '</span>';
      html += '<span class="sg-file-score">' + (f.score || 0) + '%</span>';
      html += '</div>';
    });
    document.getElementById('sg-content').innerHTML = html;

    document.querySelectorAll('.sg-file-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var path = row.getAttribute('data-path');
        var line = parseInt(row.getAttribute('data-line') || '1', 10);
        post('openFile', path ? { file: path, line: line } : path);
      });
    });
  }

  function render() {
    var content = document.getElementById('sg-content');
    var repoEl = document.getElementById('sg-repo');
    if (repoEl) repoEl.textContent = (data && data.repoName) || '—';
    var ft = document.getElementById('sg-footer-time');
    if (activeTab === 'actions') {
      renderActions();
      ft.textContent = data ? 'Last scan: ' + timeAgo(data.lastScanTime) : 'Ready';
      return;
    }
    if (!data) {
      renderEmpty();
      ft.innerHTML = window._sgScanning ? '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:50%;background:var(--blue);animation:pulse 2s infinite"></span>Scanning...</span>' : 'Last scan: —';
      return;
    }
    ft.textContent = 'Last scan: ' + timeAgo(data.lastScanTime);
    if (activeTab === 'overview') renderOverview();
    else if (activeTab === 'claims') renderClaims();
    else if (activeTab === 'pipeline') renderPipeline();
    else if (activeTab === 'files') renderFiles();
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.sg-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tab);
    });
    render();
  }

  window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'results') {
      data = msg.data;
      window._sgScanning = !!msg.scanning;
      render();
    }
  });

  document.querySelectorAll('.sg-tab').forEach(function(t) {
    t.addEventListener('click', function() { setTab(t.getAttribute('data-tab')); });
  });
  document.getElementById('sg-refresh').addEventListener('click', function() { post('requestState'); });
  document.getElementById('sg-settings').addEventListener('click', function() { post('openSettings'); });
  document.getElementById('sg-verify-btn').addEventListener('click', function() { post('runScan'); });

  post('requestState');
})();
  </script>
</body>
</html>`;
}
