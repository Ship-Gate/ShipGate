/**
 * Passing implementation — matches the Greeting domain spec.
 */
export function greet(input: { name: string }): { message: string } {
  if (!input.name || input.name.length === 0) {
    throw new Error('EMPTY_NAME');
  }
  return { message: `Hello, ${input.name}!` };
}
