import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { getInvoice } from '@/lib/api/invoice';

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Invoice</h1>
      <InvoiceForm invoice={invoice ?? undefined} mode="edit" />
    </div>
  );
}
