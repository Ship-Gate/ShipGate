/**
 * Truthpack Drift Detection
 *
 * Compares new truthpack to last stored truthpack and emits
 * "added/removed/changed" with impact assessment.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { TruthpackV2, TruthpackRoute, TruthpackEnvVar } from './schema.js';

export interface DriftChange {
  type: 'added' | 'removed' | 'changed';
  category: 'route' | 'envVar' | 'dependency' | 'dbSchema' | 'auth' | 'runtimeProbe';
  item: string;
  oldValue?: unknown;
  newValue?: unknown;
  impact: 'low' | 'medium' | 'high' | 'breaking';
  description: string;
}

export interface DriftReport {
  hasDrift: boolean;
  changes: DriftChange[];
  summary: {
    added: number;
    removed: number;
    changed: number;
    breaking: number;
  };
}

/**
 * Compare two truthpacks and generate drift report
 */
export function detectDrift(
  oldTruthpack: TruthpackV2,
  newTruthpack: TruthpackV2
): DriftReport {
  const changes: DriftChange[] = [];

  // Compare routes
  changes.push(...compareRoutes(oldTruthpack.routes, newTruthpack.routes));

  // Compare env vars
  changes.push(...compareEnvVars(oldTruthpack.envVars, newTruthpack.envVars));

  // Compare dependencies
  changes.push(...compareDependencies(oldTruthpack.dependencies, newTruthpack.dependencies));

  // Compare DB schema
  if (oldTruthpack.dbSchema || newTruthpack.dbSchema) {
    changes.push(...compareDbSchema(oldTruthpack.dbSchema, newTruthpack.dbSchema));
  }

  // Compare auth model
  if (oldTruthpack.auth || newTruthpack.auth) {
    changes.push(...compareAuthModel(oldTruthpack.auth, newTruthpack.auth));
  }

  // Compare runtime probes
  changes.push(...compareRuntimeProbes(oldTruthpack.runtimeProbes, newTruthpack.runtimeProbes));

  const summary = {
    added: changes.filter(c => c.type === 'added').length,
    removed: changes.filter(c => c.type === 'removed').length,
    changed: changes.filter(c => c.type === 'changed').length,
    breaking: changes.filter(c => c.impact === 'breaking').length,
  };

  return {
    hasDrift: changes.length > 0,
    changes,
    summary,
  };
}

/**
 * Load truthpack from directory
 */
export async function loadTruthpackFromDir(dir: string): Promise<TruthpackV2 | null> {
  try {
    const truthpackPath = path.join(dir, 'truthpack.json');
    const content = await fs.readFile(truthpackPath, 'utf-8');
    return JSON.parse(content) as TruthpackV2;
  } catch {
    return null;
  }
}

/**
 * Compare routes
 */
function compareRoutes(
  oldRoutes: TruthpackRoute[],
  newRoutes: TruthpackRoute[]
): DriftChange[] {
  const changes: DriftChange[] = [];
  const oldMap = new Map<string, TruthpackRoute>();
  const newMap = new Map<string, TruthpackRoute>();

  for (const route of oldRoutes) {
    const key = `${route.method}:${route.path}`;
    oldMap.set(key, route);
  }

  for (const route of newRoutes) {
    const key = `${route.method}:${route.path}`;
    newMap.set(key, route);
  }

  // Find added routes
  for (const [key, route] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        type: 'added',
        category: 'route',
        item: `${route.method} ${route.path}`,
        newValue: route,
        impact: route.auth?.required ? 'high' : 'medium',
        description: `New route: ${route.method} ${route.path}`,
      });
    }
  }

  // Find removed routes
  for (const [key, route] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        type: 'removed',
        category: 'route',
        item: `${route.method} ${route.path}`,
        oldValue: route,
        impact: 'breaking',
        description: `Removed route: ${route.method} ${route.path}`,
      });
    }
  }

  // Find changed routes
  for (const [key, oldRoute] of oldMap) {
    const newRoute = newMap.get(key);
    if (newRoute) {
      const differences = compareRouteDetails(oldRoute, newRoute);
      if (differences.length > 0) {
        changes.push({
          type: 'changed',
          category: 'route',
          item: `${oldRoute.method} ${oldRoute.path}`,
          oldValue: oldRoute,
          newValue: newRoute,
          impact: determineRouteChangeImpact(differences),
          description: `Route changed: ${differences.join(', ')}`,
        });
      }
    }
  }

  return changes;
}

function compareRouteDetails(old: TruthpackRoute, newRoute: TruthpackRoute): string[] {
  const differences: string[] = [];

  if (old.handler !== newRoute.handler) differences.push('handler');
  if (old.file !== newRoute.file) differences.push('file');
  if (JSON.stringify(old.parameters) !== JSON.stringify(newRoute.parameters)) {
    differences.push('parameters');
  }
  if (JSON.stringify(old.middleware) !== JSON.stringify(newRoute.middleware)) {
    differences.push('middleware');
  }
  if (JSON.stringify(old.auth) !== JSON.stringify(newRoute.auth)) {
    differences.push('auth');
  }

  return differences;
}

function determineRouteChangeImpact(differences: string[]): 'low' | 'medium' | 'high' | 'breaking' {
  if (differences.includes('auth')) return 'breaking';
  if (differences.includes('parameters')) return 'high';
  if (differences.includes('middleware')) return 'medium';
  return 'low';
}

/**
 * Compare env vars
 */
function compareEnvVars(
  oldVars: TruthpackEnvVar[],
  newVars: TruthpackEnvVar[]
): DriftChange[] {
  const changes: DriftChange[] = [];
  const oldMap = new Map<string, TruthpackEnvVar>();
  const newMap = new Map<string, TruthpackEnvVar>();

  for (const envVar of oldVars) {
    oldMap.set(envVar.name, envVar);
  }

  for (const envVar of newVars) {
    newMap.set(envVar.name, envVar);
  }

  // Find added env vars
  for (const [name, envVar] of newMap) {
    if (!oldMap.has(name)) {
      changes.push({
        type: 'added',
        category: 'envVar',
        item: name,
        newValue: envVar,
        impact: envVar.required ? 'high' : 'low',
        description: `New env var: ${name}${envVar.required ? ' (required)' : ''}`,
      });
    }
  }

  // Find removed env vars
  for (const [name, envVar] of oldMap) {
    if (!newMap.has(name)) {
      changes.push({
        type: 'removed',
        category: 'envVar',
        item: name,
        oldValue: envVar,
        impact: envVar.required ? 'breaking' : 'medium',
        description: `Removed env var: ${name}${envVar.required ? ' (was required)' : ''}`,
      });
    }
  }

  // Find changed env vars
  for (const [name, oldVar] of oldMap) {
    const newVar = newMap.get(name);
    if (newVar) {
      const differences: string[] = [];
      if (oldVar.required !== newVar.required) differences.push('required');
      if (oldVar.hasDefault !== newVar.hasDefault) differences.push('hasDefault');
      if (oldVar.defaultValue !== newVar.defaultValue) differences.push('defaultValue');
      if (oldVar.sensitive !== newVar.sensitive) differences.push('sensitive');

      if (differences.length > 0) {
        changes.push({
          type: 'changed',
          category: 'envVar',
          item: name,
          oldValue: oldVar,
          newValue: newVar,
          impact: differences.includes('required') ? 'breaking' : 'medium',
          description: `Env var changed: ${differences.join(', ')}`,
        });
      }
    }
  }

  return changes;
}

/**
 * Compare dependencies
 */
function compareDependencies(
  oldDeps: typeof TruthpackV2.prototype.dependencies,
  newDeps: typeof TruthpackV2.prototype.dependencies
): DriftChange[] {
  const changes: DriftChange[] = [];
  const oldMap = new Map<string, typeof TruthpackV2.prototype.dependencies[0]>();
  const newMap = new Map<string, typeof TruthpackV2.prototype.dependencies[0]>();

  for (const dep of oldDeps) {
    oldMap.set(dep.name, dep);
  }

  for (const dep of newDeps) {
    newMap.set(dep.name, dep);
  }

  // Find added dependencies
  for (const [name, dep] of newMap) {
    if (!oldMap.has(name)) {
      changes.push({
        type: 'added',
        category: 'dependency',
        item: name,
        newValue: dep,
        impact: dep.type === 'production' ? 'medium' : 'low',
        description: `New dependency: ${name}@${dep.version}`,
      });
    }
  }

  // Find removed dependencies
  for (const [name, dep] of oldMap) {
    if (!newMap.has(name)) {
      changes.push({
        type: 'removed',
        category: 'dependency',
        item: name,
        oldValue: dep,
        impact: dep.type === 'production' ? 'high' : 'low',
        description: `Removed dependency: ${name}`,
      });
    }
  }

  // Find changed dependencies (version changes)
  for (const [name, oldDep] of oldMap) {
    const newDep = newMap.get(name);
    if (newDep && oldDep.version !== newDep.version) {
      changes.push({
        type: 'changed',
        category: 'dependency',
        item: name,
        oldValue: oldDep,
        newValue: newDep,
        impact: determineVersionChangeImpact(oldDep.version, newDep.version),
        description: `Dependency version changed: ${name} ${oldDep.version} -> ${newDep.version}`,
      });
    }
  }

  return changes;
}

function determineVersionChangeImpact(oldVersion: string, newVersion: string): 'low' | 'medium' | 'high' | 'breaking' {
  // Simple heuristic: major version change = breaking
  const oldMajor = parseInt(oldVersion.split('.')[0] || '0', 10);
  const newMajor = parseInt(newVersion.split('.')[0] || '0', 10);
  if (oldMajor !== newMajor) return 'breaking';
  if (oldVersion !== newVersion) return 'medium';
  return 'low';
}

/**
 * Compare DB schema
 */
function compareDbSchema(
  oldSchema: TruthpackDbSchema | undefined,
  newSchema: TruthpackDbSchema | undefined
): DriftChange[] {
  const changes: DriftChange[] = [];

  if (!oldSchema && newSchema) {
    changes.push({
      type: 'added',
      category: 'dbSchema',
      item: 'database schema',
      newValue: newSchema,
      impact: 'high',
      description: 'Database schema detected',
    });
    return changes;
  }

  if (oldSchema && !newSchema) {
    changes.push({
      type: 'removed',
      category: 'dbSchema',
      item: 'database schema',
      oldValue: oldSchema,
      impact: 'breaking',
      description: 'Database schema removed',
    });
    return changes;
  }

  if (oldSchema && newSchema) {
    // Compare tables
    const oldTables = new Set(oldSchema.tables.map(t => t.name));
    const newTables = new Set(newSchema.tables.map(t => t.name));

    for (const tableName of newTables) {
      if (!oldTables.has(tableName)) {
        changes.push({
          type: 'added',
          category: 'dbSchema',
          item: `table: ${tableName}`,
          newValue: newSchema.tables.find(t => t.name === tableName),
          impact: 'high',
          description: `New table: ${tableName}`,
        });
      }
    }

    for (const tableName of oldTables) {
      if (!newTables.has(tableName)) {
        changes.push({
          type: 'removed',
          category: 'dbSchema',
          item: `table: ${tableName}`,
          oldValue: oldSchema.tables.find(t => t.name === tableName),
          impact: 'breaking',
          description: `Removed table: ${tableName}`,
        });
      }
    }
  }

  return changes;
}

/**
 * Compare auth model
 */
function compareAuthModel(
  oldAuth: TruthpackAuthModel | undefined,
  newAuth: TruthpackAuthModel | undefined
): DriftChange[] {
  const changes: DriftChange[] = [];

  if (!oldAuth && newAuth) {
    changes.push({
      type: 'added',
      category: 'auth',
      item: 'auth model',
      newValue: newAuth,
      impact: 'high',
      description: `Auth model detected: ${newAuth.provider}`,
    });
    return changes;
  }

  if (oldAuth && !newAuth) {
    changes.push({
      type: 'removed',
      category: 'auth',
      item: 'auth model',
      oldValue: oldAuth,
      impact: 'breaking',
      description: 'Auth model removed',
    });
    return changes;
  }

  if (oldAuth && newAuth && oldAuth.provider !== newAuth.provider) {
    changes.push({
      type: 'changed',
      category: 'auth',
      item: 'auth provider',
      oldValue: oldAuth,
      newValue: newAuth,
      impact: 'breaking',
      description: `Auth provider changed: ${oldAuth.provider} -> ${newAuth.provider}`,
    });
  }

  return changes;
}

/**
 * Compare runtime probes
 */
function compareRuntimeProbes(
  oldProbes: typeof TruthpackV2.prototype.runtimeProbes,
  newProbes: typeof TruthpackV2.prototype.runtimeProbes
): DriftChange[] {
  const changes: DriftChange[] = [];
  const oldMap = new Map<string, typeof TruthpackV2.prototype.runtimeProbes[0]>();
  const newMap = new Map<string, typeof TruthpackV2.prototype.runtimeProbes[0]>();

  for (const probe of oldProbes) {
    const key = `${probe.type}:${probe.endpoint}`;
    oldMap.set(key, probe);
  }

  for (const probe of newProbes) {
    const key = `${probe.type}:${probe.endpoint}`;
    newMap.set(key, probe);
  }

  for (const [key, probe] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        type: 'added',
        category: 'runtimeProbe',
        item: key,
        newValue: probe,
        impact: 'low',
        description: `New runtime probe: ${key}`,
      });
    }
  }

  for (const [key, probe] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        type: 'removed',
        category: 'runtimeProbe',
        item: key,
        oldValue: probe,
        impact: 'low',
        description: `Removed runtime probe: ${key}`,
      });
    }
  }

  return changes;
}
