import { ProductForm } from '@/components/products/ProductForm';

export default function CreateProductPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Create Product</h1>
      <ProductForm mode="create" />
    </div>
  );
}
