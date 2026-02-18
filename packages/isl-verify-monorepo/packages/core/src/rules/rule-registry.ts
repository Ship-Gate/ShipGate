import type { BaseProver } from '../provers';

export class RuleRegistry {
  private static provers: Map<string, BaseProver> = new Map();

  static register(prover: BaseProver): void {
    this.provers.set(prover.name, prover);
  }

  static get(name: string): BaseProver | undefined {
    return this.provers.get(name);
  }

  static getAll(): BaseProver[] {
    return Array.from(this.provers.values());
  }
}
