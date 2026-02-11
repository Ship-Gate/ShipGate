
export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function processPayment(
  amount: number,
  currency: string,
  cardToken: string
): Promise<{ payment?: Payment; error?: { code: string; message: string } }> {
  if (amount <= 0) {
    return { error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' } };
  }
  if (!['USD', 'EUR', 'GBP'].includes(currency)) {
    return { error: { code: 'INVALID_CURRENCY', message: 'Invalid currency' } };
  }
  
  // Simulate processing
  return {
    payment: {
      id: crypto.randomUUID(),
      amount,
      currency,
      status: 'completed',
    },
  };
}
