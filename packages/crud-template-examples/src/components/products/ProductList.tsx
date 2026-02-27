'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProductList } from '@/hooks/useProduct';

function toTitleCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
}

export function ProductList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, error } = useProductList({
    page,
    limit: 20,
    search: search || undefined,
    sortBy,
    sortOrder,
  });

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-destructive">Error loading products</div>;

  const result = data ?? { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button asChild>
          <Link href="/products/create">Create Product</Link>
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="name" value="name">Name</SelectItem>
            <SelectItem key="sku" value="sku">Sku</SelectItem>
            <SelectItem key="price" value="price">Price</SelectItem>
            <SelectItem key="stock" value="stock">Stock</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </Button>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
        <TableHead key="id">Id</TableHead>
        <TableHead key="name">Name</TableHead>
        <TableHead key="sku">Sku</TableHead>
        <TableHead key="price">Price</TableHead>
        <TableHead key="stock">Stock</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((item) => (
              <TableRow key={item.id}>
            <TableCell>{String(item.id ?? '-')}</TableCell>
            <TableCell>{String(item.name ?? '-')}</TableCell>
            <TableCell>{String(item.sku ?? '-')}</TableCell>
            <TableCell>{String(item.price ?? '-')}</TableCell>
            <TableCell>{String(item.stock ?? '-')}</TableCell>
                <TableCell>
                  <Button variant="link" size="sm" asChild>
                    <Link href={`/products/${item.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {result.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="py-2">
            Page {page} of {result.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= result.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
