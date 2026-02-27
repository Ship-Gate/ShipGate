/**
 * Type consumer test fixture
 * 
 * This file tests that the package exports are properly typed
 * and can be consumed by TypeScript consumers.
 */

import {
  // Main APIs
  ImportResolver,
  Bundler,
  resolveAndBundle,
  parseSingleFile,
  hasImports,
  createVirtualFS,
  validateImportPaths,
  
  // Types
  type ResolverOptions,
  type BundleResult,
  type ResolverError,
  ResolverErrorCode,
  type DependencyGraph,
  type ResolvedModule,
  
  // Utilities
  formatErrors,
  formatWarnings,
  
  // TS Config utilities
  parseTSConfig,
  findTSConfig,
  resolvePathAlias,
  type PathAliases,
  
  // Package exports utilities
  resolvePackageExport,
  findPackageJson,
  
  // Cache utilities
  ResolverCache,
  hashLockfile,
  type CacheKey,
  
  // Stdlib registry
  StdlibRegistryManager,
  getStdlibRegistry,
  type StdlibModule,
  
  // Module graph
  ModuleGraphBuilder,
  buildModuleGraph,
  type ModuleGraph,
  type ModuleGraphOptions,
} from '@isl-lang/import-resolver';

// Test 1: ImportResolver class
async function testImportResolver() {
  const resolver = new ImportResolver({
    basePath: '/test',
    enableImports: true,
  });
  
  const result = await resolver.resolve('./test.isl');
  
  // Type check: result should have proper types
  if (result.success && result.graph) {
    const graph: DependencyGraph = result.graph;
    const modules: Map<string, ResolvedModule> = graph.modules;
    const entryPoint: string = graph.entryPoint;
    const sortedOrder: string[] = graph.sortedOrder;
    
    // Verify types are accessible
    console.log('Graph has', modules.size, 'modules');
    console.log('Entry point:', entryPoint);
    console.log('Sorted order:', sortedOrder);
  }
  
  if (!result.success) {
    const errors: ResolverError[] = result.errors;
    const errorCode: ResolverErrorCode = errors[0]?.code ?? ResolverErrorCode.MODULE_NOT_FOUND;
    console.log('Errors:', errors.length);
  }
}

// Test 2: Bundler class
function testBundler() {
  const bundler = new Bundler({
    allowShadowing: false,
    stripImports: true,
  });
  
  // Type check: BundlerOptions should be properly typed
  const options = {
    allowShadowing: true,
    stripImports: false,
    bundleDomainName: 'test',
    bundleVersion: '1.0.0',
  };
  
  const bundler2 = new Bundler(options);
  console.log('Bundler created:', bundler2);
}

// Test 3: High-level APIs
async function testHighLevelAPIs() {
  // resolveAndBundle
  const bundleResult: BundleResult = await resolveAndBundle('./test.isl', {
    basePath: '/test',
    enableImports: true,
  });
  
  if (bundleResult.success && bundleResult.bundle) {
    console.log('Bundle successful');
  }
  
  // parseSingleFile
  const singleFileResult: BundleResult = parseSingleFile(
    'domain Test {}',
    'test.isl'
  );
  
  // hasImports
  const hasImportsResult: boolean = hasImports('import { Foo } from "./bar.isl"');
  
  // createVirtualFS
  const virtualFS = createVirtualFS({
    'test.isl': 'domain Test {}',
  });
  
  // validateImportPaths
  const validation = validateImportPaths('import { Foo } from "./bar.isl"');
  console.log('Validation valid:', validation.valid);
}

// Test 4: Utility functions
async function testUtilities() {
  // Error formatting
  const errors: ResolverError[] = [];
  const formattedErrors: string = formatErrors(errors);
  const formattedWarnings: string = formatWarnings([]);
  
  // TS Config
  const tsconfig = await parseTSConfig('/test/tsconfig.json', '/test');
  const tsconfigPath = await findTSConfig('/test');
  const aliases: PathAliases | null = tsconfig;
  if (aliases) {
    const resolved = resolvePathAlias('@/test', aliases);
    console.log('Resolved paths:', resolved);
  }
  
  // Package exports
  const packageJson = await findPackageJson('@isl-lang/parser', '/test');
  const exportPath = await resolvePackageExport('/test/node_modules/@isl-lang/parser', 'types');
  
  // Cache
  const cache = new ResolverCache();
  const key: CacheKey = {
    importPath: '/test',
    baseDir: '/test',
    tsconfigHash: 'abc',
    lockfileHash: 'def',
    fileMtime: Date.now(),
  };
  const mtime = await hashLockfile('/test');
  
  // Stdlib
  const registry = getStdlibRegistry();
  const manager = new StdlibRegistryManager({ stdlibRoot: '/test' });
  const module: StdlibModule | null = manager.getModule('@isl/auth');
  
  // Module graph
  const graphOptions: ModuleGraphOptions = {
    basePath: '/test',
    enableImports: true,
  };
  const graphBuilder = new ModuleGraphBuilder(graphOptions);
  // Note: buildModuleGraph is async, but we're just testing types here
  // const graph: ModuleGraph | null = await buildModuleGraph('./test.isl', graphOptions);
  
  // Use the variables to avoid unused variable warnings
  console.log('TSConfig:', tsconfig);
  console.log('TSConfig path:', tsconfigPath);
  console.log('Package JSON:', packageJson);
  console.log('Export path:', exportPath);
  console.log('Cache key:', key);
  console.log('Lockfile hash:', mtime);
  console.log('Registry:', registry);
  console.log('Manager:', manager);
  console.log('Module:', module);
  console.log('Graph builder:', graphBuilder);
}

// Export to ensure types are used
export {
  testImportResolver,
  testBundler,
  testHighLevelAPIs,
  testUtilities,
};
