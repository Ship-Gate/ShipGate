/**
 * Shared Webview Helpers
 *
 * Single source of truth for nonce generation, HTML escaping,
 * and the webview HTML shell used by both sidebar and report panel.
 */

import * as vscode from 'vscode';

// ============================================================================
// Nonce — prefer crypto when available
// ============================================================================

const NONCE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function getNonce(): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => NONCE_CHARS[b % NONCE_CHARS.length]).join('');
  }
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += NONCE_CHARS.charAt(Math.floor(Math.random() * NONCE_CHARS.length));
  }
  return text;
}

// ============================================================================
// HTML escape
// ============================================================================

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// Webview HTML shell
// ============================================================================

export interface WebviewHtmlOptions {
  cssFile: string;
  jsFile: string;
  title: string;
  bodyClass?: string;
  bodyHtml?: string;
  /** Additional CSS files inside media/ */
  extraCss?: string[];
}

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  opts: WebviewHtmlOptions
): string {
  const nonce = getNonce();
  const mediaUri = vscode.Uri.joinPath(extensionUri, 'media');

  const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, opts.cssFile));
  const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, opts.jsFile));

  const extraCssLinks = (opts.extraCss ?? [])
    .map((f) => {
      const uri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, f));
      return `  <link rel="stylesheet" href="${uri}">`;
    })
    .join('\n');

  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${webview.cspSource}`,
    `img-src ${webview.cspSource}`,
  ].join('; ');

  const bodyClass = opts.bodyClass ? ` class="${escapeHtml(opts.bodyClass)}"` : '';
  const bodyHtml = opts.bodyHtml ?? '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>${escapeHtml(opts.title)}</title>
  <link rel="stylesheet" href="${cssUri}">
${extraCssLinks}
</head>
<body${bodyClass}>
  ${bodyHtml}
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
}
