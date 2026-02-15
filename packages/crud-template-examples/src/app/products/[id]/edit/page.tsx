import { ProductForm } from '@/components/products/ProductForm';
import { getProduct } from '@/lib/api/product';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Product</h1>
      <ProductForm product={product ?? undefined} mode="edit" />
    </div>
  );
}
