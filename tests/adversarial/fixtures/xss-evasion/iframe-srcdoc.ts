/**
 * ADVERSARIAL FIXTURE: XSS via iframe srcdoc Attribute
 *
 * Vulnerability: User input injected into an iframe's srcdoc attribute
 * Evasion technique: srcdoc behaves exactly like innerHTML but for an
 * iframe's entire document. Scanners that check for innerHTML,
 * document.write, or dangerouslySetInnerHTML may not have srcdoc in
 * their sink list. The iframe runs in its own browsing context but
 * can still access parent cookies if same-origin.
 *
 * Exploit: userInput = '<script>parent.postMessage(document.cookie,"*")</script>'
 */

export function createPreviewFrame(htmlContent: string): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.className = "preview-frame";
  iframe.sandbox.add("allow-scripts");
  iframe.srcdoc = htmlContent;
  return iframe;
}

export function renderEmailPreview(
  container: HTMLElement,
  emailHtml: string,
) {
  const frame = document.createElement("iframe");
  frame.style.width = "100%";
  frame.style.height = "400px";
  frame.style.border = "1px solid #ccc";

  frame.srcdoc = `
    <!DOCTYPE html>
    <html>
      <head><style>body { font-family: sans-serif; padding: 16px; }</style></head>
      <body>${emailHtml}</body>
    </html>
  `;

  container.innerHTML = "";
  container.appendChild(frame);
}

export function createSandboxedWidget(
  widgetHtml: string,
  widgetCss: string,
) {
  const iframe = document.createElement("iframe");
  iframe.srcdoc = `
    <style>${widgetCss}</style>
    <div class="widget-root">${widgetHtml}</div>
  `;

  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  return iframe;
}

export function liveHtmlEditor(editorElement: HTMLElement) {
  const preview = document.createElement("iframe");
  preview.className = "live-preview";

  editorElement.addEventListener("input", () => {
    const userCode = (editorElement as HTMLTextAreaElement).value;
    preview.srcdoc = userCode;
  });

  return preview;
}
