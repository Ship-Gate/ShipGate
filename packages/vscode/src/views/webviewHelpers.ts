/**
 * Shared Webview Helpers
 *
 * Single source of truth for nonce generation, HTML escaping,
 * and the webview HTML shell used by both sidebar and report panel.
 */

import * as vscode from 'vscode';
import { join } from 'path';

// ============================================================================
// Nonce
// ============================================================================

const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function getNonce(): string {
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
  /** CSS file name inside media/ (e.g. 'shipgate.css') */
  cssFile: string;
  /** JS file name inside media/ (e.g. 'sidebar.js') */
  jsFile: string;
  /** HTML <title> */
  title: string;
  /** Extra body classes */
  bodyClass?: string;
  /** Inline HTML to place inside <body> as the initial shell */
  bodyHtml?: string;
}

/**
 * Build the complete HTML document for a webview, linking external CSS/JS
 * from the extension's media/ folder with a strict CSP.
 */
export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  opts: WebviewHtmlOptions
): string {
  const nonce = getNonce();

  const mediaUri = vscode.Uri.joinPath(extensionUri, 'media');
  const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, opts.cssFile));
  const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, opts.jsFile));

  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${webview.cspSource}`,
  ].join('; ');

  const bodyClass = opts.bodyClass ?? '';
  const bodyHtml = opts.bodyHtml ?? '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>${escapeHtml(opts.title)}</title>
  <link rel="stylesheet" href="${cssUri}">
</head>
<body class="${bodyClass}">
  ${bodyHtml}
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
}
