import type { BaseProver } from '../provers';
export declare class RuleRegistry {
    private static provers;
    static register(prover: BaseProver): void;
    static get(name: string): BaseProver | undefined;
    static getAll(): BaseProver[];
}
//# sourceMappingURL=rule-registry.d.ts.map