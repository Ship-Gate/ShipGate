export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export function ProcessPayment(input: {
  amount: number;
  currency: string;
  card_token: string;
}): Payment {
  if (input.amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  if (input.currency.length !== 3) {
    throw new Error('INVALID_CURRENCY');
  }
  if (!input.card_token) {
    throw new Error('CARD_DECLINED');
  }
  return {
    id: crypto.randomUUID(),
    amount: input.amount,
    currency: input.currency,
    status: 'completed',
  };
}
