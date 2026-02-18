export type Severity = 'error' | 'warning' | 'info';
export interface Finding {
    id: string;
    rule: string;
    message: string;
    severity: Severity;
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    snippet?: string;
    fix?: CodeFix;
}
export interface CodeFix {
    description: string;
    edits: TextEdit[];
}
export interface TextEdit {
    file: string;
    range: Range;
    newText: string;
}
export interface Range {
    start: Position;
    end: Position;
}
export interface Position {
    line: number;
    column: number;
}
export interface ProofBundle {
    version: string;
    timestamp: string;
    tier: 'tier1' | 'tier2' | 'tier3';
    findings: Finding[];
    provers: ProverResult[];
    metadata: BundleMetadata;
}
export interface ProverResult {
    name: string;
    tier: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    properties: PropertyResult[];
}
export interface PropertyResult {
    property: string;
    status: 'pass' | 'fail' | 'skip';
    message?: string;
    evidence?: unknown;
}
export interface BundleMetadata {
    project: string;
    repository?: string;
    commit?: string;
    branch?: string;
    author?: string;
}
export interface VerifyOptions {
    pattern?: string;
    config?: string;
    fix?: boolean;
    json?: boolean;
    tier?: 'tier1' | 'tier2' | 'tier3';
}
export interface Config {
    rules?: RuleConfig[];
    suppressions?: string[];
    tier?: 'tier1' | 'tier2' | 'tier3';
    license?: string;
}
export interface RuleConfig {
    rule: string;
    severity?: Severity;
    enabled?: boolean;
    options?: Record<string, unknown>;
}
