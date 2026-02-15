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
import { createInvoiceSchema, updateInvoiceSchema, type CreateInvoiceInput } from '@/lib/validators/invoice';
import { useCreateInvoice, useUpdateInvoice } from '@/hooks/useInvoice';
import type { Invoice } from '@/lib/api/invoice';

type InvoiceFormValues = CreateInvoiceInput;

interface InvoiceFormProps {
  invoice?: Invoice | null;
  mode: 'create' | 'edit';
}

export function InvoiceForm({ invoice, mode }: InvoiceFormProps) {
  const router = useRouter();
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(mode === 'create' ? createInvoiceSchema : updateInvoiceSchema),
    defaultValues: invoice ? {
      invoiceNumber: invoice?.invoiceNumber ?? '',
      customerName: invoice?.customerName ?? '',
      amount: invoice?.amount ?? 0,
      status: invoice?.status ?? ''
    } : { invoiceNumber: '', customerName: '', amount: 0, status: '' },
  });

  const onSubmit = async (data: InvoiceFormValues) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(data as CreateInvoiceInput);
        router.push('/invoices');
      } else if (invoice) {
        await updateMutation.mutateAsync({ id: invoice.id, data });
        router.push(`/invoices/${invoice.id}`);
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
          name="invoiceNumber"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Invoice Number</FormLabel>
              <FormControl>
                <Input value={String(f.value ?? '')} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="customerName"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <FormControl>
                <Input value={String(f.value ?? '')} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amount"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input type="number" value={typeof f.value === 'number' ? f.value : f.value === undefined || f.value === null ? '' : Number(f.value)} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Input value={String(f.value ?? '')} onChange={f.onChange} onBlur={f.onBlur} />
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
