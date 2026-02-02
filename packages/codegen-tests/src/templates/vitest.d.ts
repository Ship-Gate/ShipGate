export interface VitestTemplate {
    header: string;
    beforeEach: string;
    afterEach: string;
    imports: string;
}
/**
 * Get the Vitest template for test files
 */
export declare function getVitestTemplate(): VitestTemplate;
/**
 * Get Vitest configuration file content
 */
export declare function getVitestConfig(): string;
/**
 * Get Vitest setup file content
 */
export declare function getVitestSetup(): string;
/**
 * Generate a Vitest describe block
 */
export declare function generateVitestDescribe(name: string, content: string, options?: {
    skip?: boolean;
    only?: boolean;
    concurrent?: boolean;
}): string;
/**
 * Generate a Vitest it block
 */
export declare function generateVitestIt(name: string, content: string, options?: {
    async?: boolean;
    skip?: boolean;
    only?: boolean;
    concurrent?: boolean;
    timeout?: number;
}): string;
/**
 * Generate a Vitest beforeEach block
 */
export declare function generateVitestBeforeEach(content: string, options?: {
    async?: boolean;
}): string;
/**
 * Generate a Vitest afterEach block
 */
export declare function generateVitestAfterEach(content: string, options?: {
    async?: boolean;
}): string;
/**
 * Generate a Vitest mock
 */
export declare function generateVitestMock(target: string, implementation?: string): string;
/**
 * Generate a Vitest spy
 */
export declare function generateVitestSpy(object: string, method: string): string;
/**
 * Generate a Vitest fn (mock function)
 */
export declare function generateVitestFn(implementation?: string): string;
/**
 * Generate Vitest assertion
 */
export declare function generateVitestExpect(value: string, matcher: string, expected?: string): string;
/**
 * Generate Vitest snapshot test
 */
export declare function generateVitestSnapshot(value: string, inline?: boolean): string;
//# sourceMappingURL=vitest.d.ts.map