interface CommentData {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  avatarUrl?: string;
}

interface NotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error';
}

export function renderCommentList(
  container: HTMLElement,
  comments: CommentData[],
): void {
  container.innerHTML = '';

  for (const comment of comments) {
    const commentEl = document.createElement('div');
    commentEl.className = 'comment-card';

    commentEl.innerHTML = `
      <div class="comment-header">
        <img src="${comment.avatarUrl ?? '/default-avatar.png'}" alt="${comment.author}" />
        <span class="author">${comment.author}</span>
        <time datetime="${comment.createdAt}">${new Date(comment.createdAt).toLocaleDateString()}</time>
      </div>
      <div class="comment-body">${comment.body}</div>
      <div class="comment-actions">
        <button onclick="replyTo('${comment.id}')">Reply</button>
        <button onclick="reportComment('${comment.id}')">Report</button>
      </div>
    `;

    container.appendChild(commentEl);
  }
}

export function showNotification(payload: NotificationPayload): void {
  const toast = document.createElement('div');
  toast.className = `toast toast-${payload.type}`;

  toast.innerHTML = `
    <strong>${payload.title}</strong>
    <p>${payload.message}</p>
  `;

  document.getElementById('toast-container')?.appendChild(toast);

  setTimeout(() => toast.remove(), 5000);
}

export function renderUserProfile(
  container: HTMLElement,
  profile: { name: string; bio: string; website: string },
): void {
  container.innerHTML = `
    <h2>${profile.name}</h2>
    <div class="bio">${profile.bio}</div>
    <a href="${profile.website}" target="_blank">${profile.website}</a>
  `;
}
