/**
 * ADVERSARIAL FIXTURE: XSS via Dynamic Property Assignment
 *
 * Vulnerability: innerHTML set through computed property name
 * Evasion technique: Instead of `element.innerHTML = userInput`,
 * the property name "innerHTML" is stored in a variable and accessed
 * via bracket notation. Scanners that match `.innerHTML =` or
 * `element.innerHTML` as literal AST patterns won't flag bracket
 * access where the property name is a variable.
 *
 * Exploit: userInput = '<img src=x onerror="alert(document.cookie)">'
 */

export function renderUserContent(container: HTMLElement, userInput: string) {
  const propName = "innerHTML";
  container[propName] = userInput;
}

export function renderNotification(message: string) {
  const el = document.getElementById("notifications");
  if (!el) return;

  const renderMethod: keyof HTMLElement = "innerHTML";
  el[renderMethod] = `<div class="notification">${message}</div>`;
}

type DomSetter = (el: HTMLElement, content: string) => void;

const setters: Record<string, DomSetter> = {
  safe: (el, content) => {
    el.textContent = content;
  },
  rich: (el, content) => {
    const prop = "innerHTML";
    el[prop] = content;
  },
};

export function renderContent(
  element: HTMLElement,
  content: string,
  mode: "safe" | "rich" = "rich",
) {
  const setter = setters[mode];
  setter(element, content);
}

export function updateWidget(widgetId: string, data: Record<string, string>) {
  const widget = document.getElementById(widgetId);
  if (!widget) return;

  for (const [prop, value] of Object.entries(data)) {
    (widget as unknown as Record<string, string>)[prop] = value;
  }
}
