export function greet(name: string): string {
  if (!name || name.trim().length === 0) {
    throw new Error('EMPTY_NAME');
  }
  
  return `Hello, ${name}!`;
}
