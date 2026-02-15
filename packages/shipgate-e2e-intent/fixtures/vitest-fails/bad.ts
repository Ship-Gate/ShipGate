// BAD: Broken import — this will cause vitest test execution to fail
// The module 'nonexistent-math-lib' does not exist

import { superDivide } from 'nonexistent-math-lib';

export function Divide(input: { numerator: number; denominator: number }): number {
  return superDivide(input.numerator, input.denominator);
}
