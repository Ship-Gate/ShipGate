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
import { useInvoiceList } from '@/hooks/useInvoice';

function toTitleCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
}

export function InvoiceList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('invoiceNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, error } = useInvoiceList({
    page,
    limit: 20,
    search: search || undefined,
    sortBy,
    sortOrder,
  });

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-destructive">Error loading invoices</div>;

  const result = data ?? { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Button asChild>
          <Link href="/invoices/create">Create Invoice</Link>
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
            <SelectItem key="invoiceNumber" value="invoiceNumber">Invoice Number</SelectItem>
            <SelectItem key="amount" value="amount">Amount</SelectItem>
            <SelectItem key="status" value="status">Status</SelectItem>
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
        <TableHead key="invoiceNumber">Invoice Number</TableHead>
        <TableHead key="customerName">Customer Name</TableHead>
        <TableHead key="amount">Amount</TableHead>
        <TableHead key="status">Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((item) => (
              <TableRow key={item.id}>
            <TableCell>{String(item.id ?? '-')}</TableCell>
            <TableCell>{String(item.invoiceNumber ?? '-')}</TableCell>
            <TableCell>{String(item.customerName ?? '-')}</TableCell>
            <TableCell>{String(item.amount ?? '-')}</TableCell>
            <TableCell>{String(item.status ?? '-')}</TableCell>
                <TableCell>
                  <Button variant="link" size="sm" asChild>
                    <Link href={`/invoices/${item.id}`}>View</Link>
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
