/**
 * Bad implementation - NO validation (AI-generated, looks right but broken)
 * BUG: No check for amount > 0 (theft vector)
 * BUG: No check for sufficient funds (negative balance)
 */
const accounts = new Map<string, { id: string; balance: number }>();

export function transfer(fromId: string, toId: string, amount: number): { success: boolean } {
  const from = accounts.get(fromId);
  const to = accounts.get(toId);
  if (!from || !to) throw new Error("NOT_FOUND");

  // BUG: Missing all precondition checks!
  from.balance -= amount;
  to.balance += amount;
  return { success: true };
}
