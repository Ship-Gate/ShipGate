interface MessageData {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
}

interface ProfileData {
  displayName: string;
  bio: string;
  location: string;
  joinedAt: string;
}

export function renderChatMessages(
  container: HTMLElement,
  messages: MessageData[],
): void {
  container.replaceChildren();

  for (const msg of messages) {
    const wrapper = document.createElement('div');
    wrapper.className = msg.isOwn ? 'message message-own' : 'message';

    const senderEl = document.createElement('span');
    senderEl.className = 'message-sender';
    senderEl.textContent = msg.sender;
    wrapper.appendChild(senderEl);

    const bodyEl = document.createElement('p');
    bodyEl.className = 'message-body';
    bodyEl.textContent = msg.text;
    wrapper.appendChild(bodyEl);

    const timeEl = document.createElement('time');
    timeEl.className = 'message-time';
    timeEl.dateTime = msg.timestamp;
    timeEl.textContent = formatRelativeTime(msg.timestamp);
    wrapper.appendChild(timeEl);

    container.appendChild(wrapper);
  }
}

export function renderProfileCard(
  container: HTMLElement,
  profile: ProfileData,
): void {
  container.replaceChildren();

  const nameEl = document.createElement('h2');
  nameEl.textContent = profile.displayName;
  container.appendChild(nameEl);

  const bioEl = document.createElement('p');
  bioEl.className = 'profile-bio';
  bioEl.textContent = profile.bio;
  container.appendChild(bioEl);

  const locationEl = document.createElement('span');
  locationEl.className = 'profile-location';
  locationEl.textContent = profile.location;
  container.appendChild(locationEl);

  const joinedEl = document.createElement('span');
  joinedEl.className = 'profile-joined';
  joinedEl.textContent = `Joined ${new Date(profile.joinedAt).toLocaleDateString()}`;
  container.appendChild(joinedEl);
}

export function renderSearchResults(
  container: HTMLElement,
  results: Array<{ title: string; snippet: string; url: string }>,
): void {
  container.replaceChildren();

  if (results.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No results found.';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'search-results';

  for (const result of results) {
    const item = document.createElement('li');

    const link = document.createElement('a');
    link.href = encodeURI(result.url);
    link.textContent = result.title;
    item.appendChild(link);

    const snippet = document.createElement('p');
    snippet.textContent = result.snippet;
    item.appendChild(snippet);

    list.appendChild(item);
  }

  container.appendChild(list);
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
