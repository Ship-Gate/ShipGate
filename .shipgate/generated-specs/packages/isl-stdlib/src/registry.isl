# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getRegistry, resetRegistryCache, getModuleNames, getModule, getModuleByPackageName, getModulesByCategory, getCategory, getCategories, searchModules, findModulesWithEntity, findModulesWithBehavior, findModulesWithEnum, findModulesWithType, resolveDependencyTree, getImportAliases, resolveImportAlias, validateRegistry, getRegistryStats
# dependencies: 

domain Registry {
  version: "1.0.0"

  invariants exports_present {
    - true
  }
}
