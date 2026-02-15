import { PostDetail } from '@/components/posts/PostDetail';

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="p-4">
      <PostDetail id={id} />
    </div>
  );
}
