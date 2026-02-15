export interface Order {
  id: string;
  customer_id: string;
  total: number;
  status: string;
}

export function CreateOrder(input: { customer_id: string; items: string }): Order {
  if (!input.items || input.items.length === 0) {
    throw new Error('EMPTY_ITEMS');
  }
  return {
    id: crypto.randomUUID(),
    customer_id: input.customer_id,
    total: 29.99,
    status: 'pending',
  };
}
