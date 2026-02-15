const BASE = '/api/posts';

export interface Post {
  id: string;
  title: string;
  content: string | undefined;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePostInput {
  title: string;
  content?: string | undefined;
  published: boolean
}

export interface UpdatePostInput {
  title?: string | undefined;
  content?: string | undefined;
  published?: boolean | undefined
}

export interface ListPostParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  published?: string;
}

export interface ListPostResult {
  items: Post[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listPosts(params?: ListPostParams): Promise<ListPostResult> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') searchParams.set(k, String(v));
    });
  }
  const url = searchParams.toString() ? `${BASE}?${searchParams}` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export async function getPost(id: string): Promise<Post | null> {
  const res = await fetch(`${BASE}/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export async function createPost(data: CreatePostInput): Promise<Post> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

export async function updatePost(id: string, data: UpdatePostInput): Promise<Post> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}

export async function deletePost(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
}
