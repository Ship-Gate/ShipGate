'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePost, useDeletePost } from '@/hooks/usePost';

interface PostDetailProps {
  id: string;
}

export function PostDetail({ id }: PostDetailProps) {
  const router = useRouter();
  const { data: item, isLoading, error } = usePost(id);
  const deleteMutation = useDeletePost();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this Post?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      router.push('/posts');
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-destructive">Error loading Post</div>;
  if (!item) return <div className="p-4">Post not found</div>;

  return (
    <div className="space-y-4 p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Post Details</CardTitle>
          <CardDescription>View and manage this Post</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Title</span>
          <span>{String(item.title ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Content</span>
          <span>{String(item.content ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Published</span>
          <span>{String(item.published ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Created At</span>
          <span>{item.createdAt ? new Date(item.createdAt as string | Date).toLocaleString() : '-'}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Updated At</span>
          <span>{item.updatedAt ? new Date(item.updatedAt as string | Date).toLocaleString() : '-'}</span>
        </div>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href={`/posts/${id}/edit`}>Edit</Link>
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/posts">Back to list</Link>
        </Button>
      </div>
    </div>
  );
}
