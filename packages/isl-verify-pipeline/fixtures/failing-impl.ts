/**
 * Failing implementation — violates the postcondition that
 * new_value == old(value) + 1. This impl increments by 2.
 */
export function increment(input: { counter_id: string }): { new_value: number } {
  // Bug: increments by 2 instead of 1
  const currentValue = 5; // simulated lookup
  return { new_value: currentValue + 2 };
}
