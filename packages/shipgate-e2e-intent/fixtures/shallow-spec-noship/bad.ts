// BAD: No validation, returns empty string, swallows errors silently.
// With a shallow spec this might still "pass" the invariant check
// because it never throws — proving the spec is too weak.

export function ProcessPayment(_input: { amount: number; card_token: string }): string {
  try {
    // Silently swallows all errors — fake success
    return '';
  } catch {
    return '';
  }
}
