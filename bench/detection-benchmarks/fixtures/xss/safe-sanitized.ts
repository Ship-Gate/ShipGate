import DOMPurify from 'dompurify';

interface CommentData {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  avatarUrl?: string;
}

interface RichContentConfig {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripScripts?: boolean;
}

const DEFAULT_SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'blockquote', 'code', 'pre', 'h1', 'h2', 'h3',
  ],
  ALLOWED_ATTR: ['href', 'title', 'class'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
};

export function sanitizeHtml(
  dirty: string,
  config?: RichContentConfig,
): string {
  const purifyConfig: DOMPurify.Config = {
    ...DEFAULT_SANITIZE_CONFIG,
  };

  if (config?.allowedTags) {
    purifyConfig.ALLOWED_TAGS = config.allowedTags;
  }

  if (config?.allowedAttributes) {
    purifyConfig.ALLOWED_ATTR = Object.values(config.allowedAttributes).flat();
  }

  return DOMPurify.sanitize(dirty, purifyConfig);
}

export function renderCommentList(
  container: HTMLElement,
  comments: CommentData[],
): void {
  container.innerHTML = '';

  for (const comment of comments) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-card';

    const header = document.createElement('div');
    header.className = 'comment-header';

    const avatar = document.createElement('img');
    avatar.src = comment.avatarUrl ?? '/default-avatar.png';
    avatar.alt = DOMPurify.sanitize(comment.author);
    header.appendChild(avatar);

    const authorSpan = document.createElement('span');
    authorSpan.className = 'author';
    authorSpan.textContent = comment.author;
    header.appendChild(authorSpan);

    const timeEl = document.createElement('time');
    timeEl.dateTime = comment.createdAt;
    timeEl.textContent = new Date(comment.createdAt).toLocaleDateString();
    header.appendChild(timeEl);

    commentEl.appendChild(header);

    const body = document.createElement('div');
    body.className = 'comment-body';
    body.innerHTML = sanitizeHtml(comment.body);
    commentEl.appendChild(body);

    container.appendChild(commentEl);
  }
}

export function renderRichContent(
  container: HTMLElement,
  htmlContent: string,
): void {
  const clean = sanitizeHtml(htmlContent);
  container.innerHTML = clean;
}

export function createSafeMarkup(rawHtml: string): { __html: string } {
  return { __html: sanitizeHtml(rawHtml) };
}
