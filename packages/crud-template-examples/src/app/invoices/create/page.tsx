import { InvoiceForm } from '@/components/invoices/InvoiceForm';

export default function CreateInvoicePage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Create Invoice</h1>
      <InvoiceForm mode="create" />
    </div>
  );
}
