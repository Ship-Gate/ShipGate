import { something } from './nonexistent';
import { other } from '../missing';

export function main() {
  return { something, other };
}
