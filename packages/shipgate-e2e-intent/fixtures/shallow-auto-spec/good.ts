// This file has rich exports that an auto-generated spec can meaningfully verify

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  createdAt: Date;
}

export function createUserProfile(
  email: string,
  displayName: string,
  bio?: string,
): UserProfile {
  if (!email || !email.includes('@')) {
    throw new Error('INVALID_EMAIL');
  }
  if (!displayName || displayName.length === 0) {
    throw new Error('INVALID_DISPLAY_NAME');
  }
  return {
    id: crypto.randomUUID(),
    email,
    displayName,
    bio: bio ?? '',
    avatarUrl: `https://avatars.example.com/${encodeURIComponent(displayName)}`,
    createdAt: new Date(),
  };
}

export function validateEmail(email: string): boolean {
  return email.includes('@') && email.includes('.');
}

export function formatDisplayName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`;
}
