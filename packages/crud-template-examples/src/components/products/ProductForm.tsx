'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { createProductSchema, updateProductSchema, type CreateProductInput } from '@/lib/validators/product';
import { useCreateProduct, useUpdateProduct } from '@/hooks/useProduct';
import type { Product } from '@/lib/api/product';

type ProductFormValues = CreateProductInput;

interface ProductFormProps {
  product?: Product | null;
  mode: 'create' | 'edit';
}

export function ProductForm({ product, mode }: ProductFormProps) {
  const router = useRouter();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(mode === 'create' ? createProductSchema : updateProductSchema),
    defaultValues: product ? {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      price: product?.price ?? 0,
      stock: product?.stock ?? 0
    } : { name: '', sku: '', price: 0, stock: 0 },
  });

  const onSubmit = async (data: ProductFormValues) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(data as CreateProductInput);
        router.push('/products');
      } else if (product) {
        await updateMutation.mutateAsync({ id: product.id, data });
        router.push(`/products/${product.id}`);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form form={form} onSubmit={onSubmit} className="space-y-6 max-w-md">
        <FormField
          control={form.control}
          name="name"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input value={String(f.value ?? '')} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sku"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Sku</FormLabel>
              <FormControl>
                <Input value={String(f.value ?? '')} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="price"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <Input type="number" value={typeof f.value === 'number' ? f.value : f.value === undefined || f.value === null ? '' : Number(f.value)} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="stock"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Stock</FormLabel>
              <FormControl>
                <Input type="number" value={typeof f.value === 'number' ? f.value : f.value === undefined || f.value === null ? '' : Number(f.value)} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
        </Button>
    </Form>
  );
}
