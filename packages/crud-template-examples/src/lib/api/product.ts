const BASE = '/api/products';

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  price: number;
  stock: number
}

export interface UpdateProductInput {
  name?: string | undefined;
  sku?: string | undefined;
  price?: number | undefined;
  stock?: number | undefined
}

export interface ListProductParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  price?: string;
}

export interface ListProductResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listProducts(params?: ListProductParams): Promise<ListProductResult> {
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

export async function getProduct(id: string): Promise<Product | null> {
  const res = await fetch(`${BASE}/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export async function createProduct(data: CreateProductInput): Promise<Product> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

export async function updateProduct(id: string, data: UpdateProductInput): Promise<Product> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
}
