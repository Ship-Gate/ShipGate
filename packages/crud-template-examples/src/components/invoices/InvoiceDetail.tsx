'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useInvoice, useDeleteInvoice } from '@/hooks/useInvoice';

interface InvoiceDetailProps {
  id: string;
}

export function InvoiceDetail({ id }: InvoiceDetailProps) {
  const router = useRouter();
  const { data: item, isLoading, error } = useInvoice(id);
  const deleteMutation = useDeleteInvoice();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this Invoice?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      router.push('/invoices');
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-destructive">Error loading Invoice</div>;
  if (!item) return <div className="p-4">Invoice not found</div>;

  return (
    <div className="space-y-4 p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
          <CardDescription>View and manage this Invoice</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Invoice Number</span>
          <span>{String(item.invoiceNumber ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Customer Name</span>
          <span>{String(item.customerName ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Amount</span>
          <span>{String(item.amount ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Status</span>
          <span>{String(item.status ?? '-')}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Created At</span>
          <span>{item.createdAt ? new Date(item.createdAt as string | Date).toLocaleString() : '-'}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Updated At</span>
          <span>{item.updatedAt ? new Date(item.updatedAt as string | Date).toLocaleString() : '-'}</span>
        </div>
        <div className="flex py-2 border-b">
          <span className="font-medium w-40">Deleted At</span>
          <span>{item.deletedAt ? new Date(item.deletedAt as string | Date).toLocaleString() : '-'}</span>
        </div>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href={`/invoices/${id}/edit`}>Edit</Link>
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/invoices">Back to list</Link>
        </Button>
      </div>
    </div>
  );
}
