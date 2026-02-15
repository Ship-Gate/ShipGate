const BASE = '/api/invoices';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | undefined;
}

export interface CreateInvoiceInput {
  invoiceNumber: string;
  customerName: string;
  amount: number;
  status: string
}

export interface UpdateInvoiceInput {
  invoiceNumber?: string | undefined;
  customerName?: string | undefined;
  amount?: number | undefined;
  status?: string | undefined
}

export interface ListInvoiceParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  status?: string;
}

export interface ListInvoiceResult {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listInvoices(params?: ListInvoiceParams): Promise<ListInvoiceResult> {
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

export async function getInvoice(id: string): Promise<Invoice | null> {
  const res = await fetch(`${BASE}/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export async function createInvoice(data: CreateInvoiceInput): Promise<Invoice> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput): Promise<Invoice> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}

export async function deleteInvoice(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
}
