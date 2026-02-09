/**
 * Fallback: Use this if the AI generates correct code.
 * Copy to src/transfer.ts for the gate to catch it.
 */
import { accounts } from './accounts.js';

export function transfer(
  senderId: string,
  receiverId: string,
  amount: number
): { success: boolean; transactionId: string } {
  const sender = accounts.get(senderId);
  const receiver = accounts.get(receiverId);

  if (!sender || !receiver) throw new Error('Account not found');

  sender.balance -= amount;
  receiver.balance += amount;
  return { success: true, transactionId: `tx_${Date.now()}` };
}
