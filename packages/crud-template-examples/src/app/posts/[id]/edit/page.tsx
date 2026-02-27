import { PostForm } from '@/components/posts/PostForm';
import { getPost } from '@/lib/api/post';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Post</h1>
      <PostForm post={post ?? undefined} mode="edit" />
    </div>
  );
}
