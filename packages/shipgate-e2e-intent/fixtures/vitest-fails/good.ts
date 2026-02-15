export function Divide(input: { numerator: number; denominator: number }): number {
  if (input.denominator === 0) {
    throw new Error('DIVISION_BY_ZERO');
  }
  return input.numerator / input.denominator;
}
