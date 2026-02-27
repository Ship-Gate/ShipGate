// Good implementation with real validation and error handling.
// But with a shallow spec, even good code shouldn't get SHIP —
// the spec doesn't verify postconditions or error cases.

export function ProcessPayment(input: { amount: number; card_token: string }): string {
  if (input.amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  if (!input.card_token || input.card_token.length < 10) {
    throw new Error('INVALID_CARD');
  }
  // In reality this would call a payment gateway
  return `payment_${Date.now()}_confirmed`;
}
