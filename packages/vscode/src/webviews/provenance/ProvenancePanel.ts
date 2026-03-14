/**
 * VS Code Provenance Panel
 *
 * Shows per-file AI attribution in the ShipGate sidebar.
 * Displays which AI agent wrote each section of the current file.
 */

import * as vscode from 'vscode';

export class ProvenancePanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'shipgate.provenance';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml();

    vscode.window.onDidChangeActiveTextEditor(() => this._refresh());
    this._refresh();
  }

  private async _refresh() {
    if (!this._view) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._view.webview.postMessage({ type: 'clear' });
      return;
    }

    const filePath = vscode.workspace.asRelativePath(editor.document.uri);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      this._view.webview.postMessage({ type: 'clear' });
      return;
    }

    try {
      const { execSync } = require('child_process');

      const raw = execSync(`git blame --porcelain -- "${filePath}"`, {
        cwd: workspaceFolder,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stats = parseBlameStats(raw);
      this._view.webview.postMessage({
        type: 'update',
        data: {
          file: filePath,
          ...stats,
        },
      });
    } catch {
      this._view.webview.postMessage({
        type: 'error',
        message: 'Not a git repository or file is untracked',
      });
    }
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; font-size: 12px; }
    .header { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--vscode-widget-border); }
    .stat-label { opacity: 0.7; }
    .stat-value { font-weight: 600; font-variant-numeric: tabular-nums; }
    .bar-container { margin: 12px 0; height: 8px; border-radius: 4px; background: var(--vscode-progressBar-background); overflow: hidden; display: flex; }
    .bar-human { background: #00e68a; height: 100%; }
    .bar-ai { background: #8b5cf6; height: 100%; }
    .legend { display: flex; gap: 16px; margin-top: 8px; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
    .authors { margin-top: 16px; }
    .author-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
    .empty { text-align: center; padding: 24px 0; opacity: 0.5; }
    .file-name { font-family: var(--vscode-editor-font-family); font-size: 11px; opacity: 0.6; margin-bottom: 8px; }
    .agent-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin: 2px; }
  </style>
</head>
<body>
  <div class="header">Code Provenance</div>
  <div id="content"><div class="empty">Open a file to see attribution</div></div>
  <script>
    const content = document.getElementById('content');
    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg.type === 'clear') {
        content.innerHTML = '<div class="empty">Open a file to see attribution</div>';
      } else if (msg.type === 'error') {
        content.innerHTML = '<div class="empty">' + msg.message + '</div>';
      } else if (msg.type === 'update') {
        const d = msg.data;
        const humanPct = d.total > 0 ? Math.round((d.human / d.total) * 100) : 0;
        const aiPct = 100 - humanPct;
        let html = '<div class="file-name">' + d.file + '</div>';
        html += '<div class="stat-row"><span class="stat-label">Total Lines</span><span class="stat-value">' + d.total + '</span></div>';
        html += '<div class="stat-row"><span class="stat-label">Human</span><span class="stat-value" style="color:#00e68a">' + humanPct + '%</span></div>';
        html += '<div class="stat-row"><span class="stat-label">AI-Assisted</span><span class="stat-value" style="color:#8b5cf6">' + aiPct + '%</span></div>';
        html += '<div class="bar-container"><div class="bar-human" style="width:' + humanPct + '%"></div><div class="bar-ai" style="width:' + aiPct + '%"></div></div>';
        html += '<div class="legend"><div class="legend-item"><div class="legend-dot" style="background:#00e68a"></div>Human</div><div class="legend-item"><div class="legend-dot" style="background:#8b5cf6"></div>AI</div></div>';
        if (d.authors && d.authors.length > 0) {
          html += '<div class="authors"><div style="font-weight:600;margin-bottom:6px">Authors</div>';
          d.authors.forEach(a => {
            html += '<div class="author-row"><span>' + a.name + '</span><span>' + a.lines + ' lines</span></div>';
          });
          html += '</div>';
        }
        if (d.agents && d.agents.length > 0) {
          html += '<div class="authors" style="margin-top:12px"><div style="font-weight:600;margin-bottom:6px">AI Agents</div>';
          d.agents.forEach(a => {
            const colors = {cursor:'#8b5cf6',copilot:'#3b82f6','claude-code':'#f97316',codex:'#10b981',gemini:'#ef4444',windsurf:'#06b6d4',aider:'#eab308',cody:'#ec4899'};
            const c = colors[a.tool] || '#6b7280';
            html += '<div class="author-row"><span class="agent-badge" style="background:' + c + '20;color:' + c + '">' + a.tool + '</span><span>' + a.lines + ' lines</span></div>';
          });
          html += '</div>';
        }
        content.innerHTML = html;
      }
    });
  </script>
</body>
</html>`;
  }
}

interface BlameStats {
  total: number;
  human: number;
  ai: number;
  authors: Array<{ name: string; lines: number }>;
  agents: Array<{ tool: string; lines: number }>;
}

function parseBlameStats(raw: string): BlameStats {
  const lines = raw.split('\n');
  const authorCounts = new Map<string, number>();
  const commitTrailers = new Map<string, string | null>();
  let totalLines = 0;
  let i = 0;

  while (i < lines.length) {
    const headerMatch = lines[i]?.match(/^([0-9a-f]{40})\s+\d+\s+\d+/);
    if (!headerMatch) { i++; continue; }

    const hash = headerMatch[1]!;
    i++;

    let author = '';
    let aiTool: string | null = null;

    if (!commitTrailers.has(hash)) {
      while (i < lines.length && !lines[i]!.startsWith('\t')) {
        if (lines[i]!.startsWith('author ')) author = lines[i]!.slice(7);
        if (lines[i]!.startsWith('summary ')) {
          const summary = lines[i]!.slice(8);
          const toolMatch = summary.match(/\[(cursor|copilot|claude|codex|gemini|windsurf|aider|cody)\]/i);
          if (toolMatch) aiTool = toolMatch[1]!.toLowerCase();
          if (/aider:/i.test(summary)) aiTool = 'aider';
        }
        i++;
      }
      commitTrailers.set(hash, aiTool);
    } else {
      while (i < lines.length && !lines[i]!.startsWith('\t')) {
        if (lines[i]!.startsWith('author ')) author = lines[i]!.slice(7);
        i++;
      }
      aiTool = commitTrailers.get(hash) ?? null;
    }

    if (i < lines.length && lines[i]!.startsWith('\t')) i++;

    totalLines++;
    if (author) {
      authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
    }
  }

  const agentCounts = new Map<string, number>();
  let aiLines = 0;
  for (const [, tool] of commitTrailers) {
    if (tool) {
      aiLines++;
      agentCounts.set(tool, (agentCounts.get(tool) ?? 0) + 1);
    }
  }

  return {
    total: totalLines,
    human: totalLines - aiLines,
    ai: aiLines,
    authors: [...authorCounts.entries()]
      .map(([name, lines]) => ({ name, lines }))
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10),
    agents: [...agentCounts.entries()]
      .map(([tool, lines]) => ({ tool, lines }))
      .sort((a, b) => b.lines - a.lines),
  };
}
