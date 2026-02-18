import { BaseProver, type ProverContext } from './base-prover';
import type { ProverResult } from '../types';
export declare class Tier1StaticProver extends BaseProver {
    readonly name = "tier1-static";
    readonly tier = 1;
    readonly properties: string[];
    verify(context: ProverContext): Promise<ProverResult>;
    private checkNullSafety;
    private checkBoundsChecking;
    private checkTypeSafety;
    private checkUnusedCode;
    private checkErrorHandling;
    private checkInputValidation;
    private checkResourceLeaks;
}
//# sourceMappingURL=tier1-static.d.ts.map