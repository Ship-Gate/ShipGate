/**
 * Evidence HTML Report Renderer
 *
 * Produces a self-contained single-file HTML report from a JSON evidence bundle.
 * No external CDN dependencies — works fully offline.
 */

import { readFile } from 'fs/promises';
import { readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { execSync } from 'child_process';

export interface EvidenceBundle {
  verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
  score: number;
  timestamp: string;
  duration: number;
  files: Array<{
    file: string;
    status: string;
    score: number;
    blockers?: string[];
  }>;
  stages?: Array<{
    name: string;
    duration: number;
    status: string;
  }>;
  violations?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Render an evidence bundle as a self-contained HTML file.
 */
export function renderEvidenceHTML(bundle: EvidenceBundle): string {
  const verdictColor = bundle.verdict === 'SHIP' ? '#22c55e'
    : bundle.verdict === 'WARN' ? '#eab308'
    : '#ef4444';

  const verdictBg = bundle.verdict === 'SHIP' ? '#dcfce7'
    : bundle.verdict === 'WARN' ? '#fef9c3'
    : '#fecaca';

  const filesHTML = bundle.files.map(f => {
    const statusIcon = f.status === 'PASS' ? '&#10003;' : '&#10007;';
    const statusColor = f.status === 'PASS' ? '#22c55e' : '#ef4444';
    const blockersList = (f.blockers ?? []).map(b => `<li>${escapeHtml(b)}</li>`).join('');

    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(f.file)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;color:${statusColor};font-weight:bold;">${statusIcon} ${escapeHtml(f.status)}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${(f.score * 100).toFixed(0)}%</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${blockersList ? `<ul style="margin:0;padding-left:16px;">${blockersList}</ul>` : '—'}</td>
    </tr>`;
  }).join('\n');

  const stagesHTML = (bundle.stages ?? []).map(s => {
    const icon = s.status === 'success' ? '&#10003;' : '&#10007;';
    const color = s.status === 'success' ? '#22c55e' : '#ef4444';
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
      <span style="color:${color};">${icon}</span>
      <span>${escapeHtml(s.name)}</span>
      <span style="color:#9ca3af;margin-left:auto;">${s.duration}ms</span>
    </div>`;
  }).join('\n');

  const violationsHTML = (bundle.violations ?? []).map(v =>
    `<li style="color:#ef4444;padding:2px 0;">${escapeHtml(v)}</li>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ShipGate Evidence Report — ${bundle.verdict}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #1f2937; line-height: 1.5; padding: 24px; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 16px; }
  h2 { font-size: 18px; margin: 24px 0 12px; color: #374151; }
  .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 16px; }
  .verdict-badge { display: inline-block; padding: 6px 16px; border-radius: 6px; font-weight: 700; font-size: 20px; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .meta-item { background: #f3f4f6; padding: 12px; border-radius: 6px; }
  .meta-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
  .meta-value { font-size: 18px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px; background: #f3f4f6; border-bottom: 2px solid #e5e7eb; font-size: 13px; text-transform: uppercase; color: #6b7280; }
  .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 12px; }
</style>
</head>
<body>
<h1>ShipGate Evidence Report</h1>

<div class="card">
  <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
    <span class="verdict-badge" style="background:${verdictBg};color:${verdictColor};">${bundle.verdict}</span>
    <span style="font-size:14px;color:#6b7280;">${bundle.timestamp}</span>
  </div>

  <div class="meta" style="margin-top:16px;">
    <div class="meta-item"><div class="meta-label">Score</div><div class="meta-value">${(bundle.score * 100).toFixed(0)}%</div></div>
    <div class="meta-item"><div class="meta-label">Files</div><div class="meta-value">${bundle.files.length}</div></div>
    <div class="meta-item"><div class="meta-label">Duration</div><div class="meta-value">${(bundle.duration / 1000).toFixed(1)}s</div></div>
    <div class="meta-item"><div class="meta-label">Violations</div><div class="meta-value">${(bundle.violations ?? []).length}</div></div>
  </div>
</div>

${stagesHTML ? `<div class="card"><h2>Pipeline Stages</h2>${stagesHTML}</div>` : ''}

<div class="card">
  <h2>File Results</h2>
  <table>
    <thead><tr><th>File</th><th style="text-align:center;">Status</th><th style="text-align:center;">Score</th><th>Blockers</th></tr></thead>
    <tbody>${filesHTML || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#9ca3af;">No files analyzed</td></tr>'}</tbody>
  </table>
</div>

${violationsHTML ? `<div class="card"><h2>Violations</h2><ul style="padding-left:20px;">${violationsHTML}</ul></div>` : ''}

<div class="footer">
  Generated by ShipGate &middot; ${new Date().toISOString()}
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Load a JSON evidence bundle and render to HTML.
 */
export async function renderBundleToHTML(jsonPath: string): Promise<string> {
  const content = await readFile(resolve(jsonPath), 'utf-8');
  const bundle = JSON.parse(content) as EvidenceBundle;
  return renderEvidenceHTML(bundle);
}

/**
 * Open the most recent evidence report in the default browser.
 */
export async function openEvidence(dir?: string): Promise<{ opened: boolean; path: string | null }> {
  const searchDir = resolve(dir ?? '.shipgate/evidence');
  try {
    const entries = readdirSync(searchDir)
      .filter(f => f.endsWith('.html') || f.endsWith('.json'))
      .map(f => ({ name: f, mtime: statSync(join(searchDir, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);

    if (entries.length === 0) {
      return { opened: false, path: null };
    }

    const targetFile = join(searchDir, entries[0]!.name);
    try {
      const platform = process.platform;
      const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${cmd} "${targetFile}"`);
      return { opened: true, path: targetFile };
    } catch {
      return { opened: false, path: targetFile };
    }
  } catch {
    return { opened: false, path: null };
  }
}
