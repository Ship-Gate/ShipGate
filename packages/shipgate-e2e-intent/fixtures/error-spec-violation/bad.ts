// BAD: Doesn't throw on invalid input — violates error spec
// Spec says INVALID_AMOUNT when amount <= 0, but this silently returns

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
  // Missing: no validation — negative amounts silently accepted
  // Missing: no currency length check
  return {
    id: crypto.randomUUID(),
    amount: input.amount,
    currency: input.currency,
    status: 'completed',
  };
}
