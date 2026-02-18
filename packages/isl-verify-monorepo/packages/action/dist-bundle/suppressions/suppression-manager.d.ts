import type { Finding } from '../types';
export declare class SuppressionManager {
    private suppressions;
    addSuppression(pattern: string): void;
    isSuppressed(finding: Finding): boolean;
    private matches;
    filter(findings: Finding[]): Finding[];
}
//# sourceMappingURL=suppression-manager.d.ts.map