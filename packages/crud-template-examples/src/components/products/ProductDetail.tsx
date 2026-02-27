'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProduct, useDeleteProduct } from '@/hooks/useProduct';

interface ProductDetailProps {
  id: string;
}

export function ProductDetail({ id }: ProductDetailProps) {
  const router = useRouter();
  const { data: item, isLoading, error } = useProduct(id);
  const deleteMutation = useDeleteProduct();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this Product?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      router.push('/products');
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-destructive">Error loading Product</div>;
  if (!item) return <div className="p-4">Product not found</div>;

  return (
    <div className="space-y-4 p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>View and manage this Product</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Name</span>
          <span>{String(item.name ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Sku</span>
          <span>{String(item.sku ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Price</span>
          <span>{String(item.price ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Stock</span>
          <span>{String(item.stock ?? '-')}</span>
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
          <Link href={`/products/${id}/edit`}>Edit</Link>
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/products">Back to list</Link>
        </Button>
      </div>
    </div>
  );
}
