export interface JestTemplate {
    header: string;
    beforeEach: string;
    afterEach: string;
    imports: string;
}
/**
 * Get the Jest template for test files
 */
export declare function getJestTemplate(): JestTemplate;
/**
 * Get Jest configuration file content
 */
export declare function getJestConfig(): string;
/**
 * Get Jest setup file content
 */
export declare function getJestSetup(): string;
/**
 * Generate a Jest describe block
 */
export declare function generateJestDescribe(name: string, content: string, options?: {
    skip?: boolean;
    only?: boolean;
}): string;
/**
 * Generate a Jest it block
 */
export declare function generateJestIt(name: string, content: string, options?: {
    async?: boolean;
    skip?: boolean;
    only?: boolean;
    timeout?: number;
}): string;
/**
 * Generate a Jest beforeEach block
 */
export declare function generateJestBeforeEach(content: string, options?: {
    async?: boolean;
}): string;
/**
 * Generate a Jest afterEach block
 */
export declare function generateJestAfterEach(content: string, options?: {
    async?: boolean;
}): string;
/**
 * Generate a Jest mock call
 */
export declare function generateJestMock(target: string, implementation?: string): string;
/**
 * Generate a Jest spy
 */
export declare function generateJestSpy(object: string, method: string): string;
/**
 * Generate Jest assertion
 */
export declare function generateJestExpect(value: string, matcher: string, expected?: string): string;
//# sourceMappingURL=jest.d.ts.map