#!/usr/bin/env tsx
/**
 * Agent 41 — Stub Hunter & Completion Orchestrator
 * 
 * Produces an exact inventory of stubbed/shell packages and generates
 * a priority-ranked completion plan based on dependency impact and product surface.
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ============================================================================
// Stub Detection Patterns
// ============================================================================

interface StubPattern {
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const STUB_PATTERNS: StubPattern[] = [
  // Critical: Explicit "Not implemented" throws
  {
    name: 'throw-not-implemented',
    pattern: /throw\s+new\s+Error\s*\(\s*['"`]Not\s+(yet\s+)?implemented['"`]\s*\)/gi,
    severity: 'critical',
  },
  {
    name: 'throw-todo',
    pattern: /throw\s+new\s+Error\s*\(\s*['"`]TODO['"`]\s*\)/gi,
    severity: 'critical',
  },
  {
    name: 'throw-stub',
    pattern: /throw\s+new\s+Error\s*\(\s*['"`]STUB['"`]\s*\)/gi,
    severity: 'critical',
  },
  {
    name: 'throw-placeholder',
    pattern: /throw\s+new\s+Error\s*\(\s*['"`]PLACEHOLDER['"`]\s*\)/gi,
    severity: 'critical',
  },
  {
    name: 'throw-fixme',
    pattern: /throw\s+new\s+Error\s*\(\s*['"`]FIXME['"`]\s*\)/gi,
    severity: 'critical',
  },
  
  // High: Placeholder implementations
  {
    name: 'placeholder-comment',
    pattern: /\/\/\s*Implementation\s+goes\s+here/i,
    severity: 'high',
  },
  {
    name: 'todo-implement',
    pattern: /\/\/\s*TODO:\s*implement\s+(this|handler|function|method)?/i,
    severity: 'high',
  },
  {
    name: 'fixme-implement',
    pattern: /\/\/\s*FIXME:\s*implement/i,
    severity: 'high',
  },
  {
    name: 'placeholder-implementation',
    pattern: /\/\/\s*placeholder\s*(implementation)?/i,
    severity: 'high',
  },
  {
    name: 'return-stub',
    pattern: /return\s*;?\s*\/\/\s*stub/i,
    severity: 'high',
  },
  {
    name: 'empty-todo-block',
    pattern: /\{\s*\/\/\s*TODO\s*\}/,
    severity: 'high',
  },
  
  // Medium: Placeholder function bodies
  {
    name: 'placeholder-function-throw',
    pattern: /(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*\{[\s\n]*throw\s+new\s+Error\s*\(\s*['"`](TODO|FIXME)/gi,
    severity: 'medium',
  },
  {
    name: 'placeholder-arrow-throw',
    pattern: /const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[\s\n]*throw\s+new\s+Error\s*\(\s*['"`](TODO|FIXME)/gi,
    severity: 'medium',
  },
  
  // Medium: Placeholder return values
  {
    name: 'return-null-stub',
    pattern: /return\s+null\s*;?\s*\/\/\s*(stub|TODO|placeholder)/i,
    severity: 'medium',
  },
  {
    name: 'return-empty-object',
    pattern: /return\s+\{\s*\}\s*;?\s*\/\/\s*(stub|TODO|placeholder)/i,
    severity: 'medium',
  },
  {
    name: 'return-placeholder-string',
    pattern: /return\s+['"`]\[Placeholder[^'"`]*['"`]\s*;?/i,
    severity: 'medium',
  },
  
  // Low: Console.log TODO
  {
    name: 'console-todo',
    pattern: /console\.(log|warn|error)\s*\(\s*['"`]TODO['"`]/gi,
    severity: 'low',
  },
];

// ============================================================================
// Package Analysis
// ============================================================================

interface StubEvidence {
  file: string;
  line: number;
  pattern: string;
  severity: string;
  snippet: string;
}

interface PackageAnalysis {
  name: string;
  path: string;
  stubScore: number; // 0-100, higher = more stubbed
  integrationScore: number; // 0-100, higher = more referenced
  userFacingScore: number; // 0-100, higher = more user-facing
  priorityScore: number; // Combined score for prioritization
  stubEvidence: StubEvidence[];
  hasTests: boolean;
  hasReadme: boolean;
  hasExports: boolean;
  isEmpty: boolean;
  upstreamDependents: string[];
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  recommendedActions: string[];
}

function getAllPackages(): string[] {
  const packagesDir = join(ROOT, 'packages');
  if (!existsSync(packagesDir)) {
    return [];
  }
  
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .map(name => join(packagesDir, name));
}

function readPackageJson(pkgPath: string): { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null {
  const pkgJsonPath = join(pkgPath, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(pkgJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function findStubsInFile(filePath: string): StubEvidence[] {
  const evidence: StubEvidence[] = [];
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const pattern of STUB_PATTERNS) {
      const matches = [...content.matchAll(pattern.pattern)];
      for (const match of matches) {
        if (match.index === undefined) continue;
        
        const lineNum = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNum - 1]?.trim() || '';
        
        // Skip test files and fixtures
        if (filePath.includes('.test.') || filePath.includes('.spec.') || 
            filePath.includes('__mocks__') || filePath.includes('__fixtures__') ||
            filePath.includes('/mocks/') || filePath.includes('/fixtures/') ||
            filePath.includes('/test-fixtures/') || filePath.includes('/demo/') ||
            filePath.includes('/examples/')) {
          continue;
        }
        
        evidence.push({
          file: relative(ROOT, filePath),
          line: lineNum,
          pattern: pattern.name,
          severity: pattern.severity,
          snippet: line.substring(0, 100),
        });
      }
    }
  } catch (error) {
    // Skip files that can't be read
  }
  
  return evidence;
}

function scanPackageForStubs(pkgPath: string): StubEvidence[] {
  const evidence: StubEvidence[] = [];
  
  function scanDirectory(dir: string) {
    if (!existsSync(dir)) return;
    
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        // Skip node_modules, dist, build, .git
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '.turbo') {
          continue;
        }
        
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile()) {
          // Only scan TypeScript/JavaScript files
          if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
            const fileEvidence = findStubsInFile(fullPath);
            evidence.push(...fileEvidence);
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  scanDirectory(pkgPath);
  return evidence;
}

function checkPackageFiles(pkgPath: string): { hasTests: boolean; hasReadme: boolean; hasExports: boolean; isEmpty: boolean } {
  const hasTests = existsSync(join(pkgPath, 'tests')) || 
                   existsSync(join(pkgPath, '__tests__')) ||
                   globFiles(pkgPath, '**/*.test.ts').length > 0 ||
                   globFiles(pkgPath, '**/*.spec.ts').length > 0;
  
  const hasReadme = existsSync(join(pkgPath, 'README.md'));
  
  const srcDir = join(pkgPath, 'src');
  const indexFiles = [
    join(pkgPath, 'index.ts'),
    join(pkgPath, 'index.js'),
    join(srcDir, 'index.ts'),
    join(srcDir, 'index.js'),
  ];
  
  let hasExports = false;
  let isEmpty = true;
  
  for (const indexFile of indexFiles) {
    if (existsSync(indexFile)) {
      hasExports = true;
      try {
        const content = readFileSync(indexFile, 'utf-8');
        // Check if it's not just empty or re-exports
        if (content.trim().length > 50 && !content.includes('export * from')) {
          isEmpty = false;
        }
      } catch {}
    }
  }
  
  // Check if src directory has substantial files
  if (existsSync(srcDir)) {
    const srcFiles = globFiles(srcDir, '**/*.ts').filter(f => !f.includes('.test.') && !f.includes('.spec.'));
    if (srcFiles.length > 0) {
      isEmpty = false;
    }
  }
  
  return { hasTests, hasReadme, hasExports, isEmpty };
}

function globFiles(dir: string, pattern: string): string[] {
  const files: string[] = [];
  
  function scan(currentDir: string) {
    if (!existsSync(currentDir)) return;
    
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build') {
          continue;
        }
        
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile()) {
          const relPath = relative(dir, fullPath);
          if (matchPattern(relPath, pattern)) {
            files.push(fullPath);
          }
        }
      }
    } catch {}
  }
  
  scan(dir);
  return files;
}

function matchPattern(path: string, pattern: string): boolean {
  // Simple glob matching
  const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
  return regex.test(path);
}

function calculateStubScore(evidence: StubEvidence[]): number {
  if (evidence.length === 0) return 0;
  
  let score = 0;
  const severityWeights = { critical: 30, high: 20, medium: 10, low: 5 };
  
  for (const ev of evidence) {
    score += severityWeights[ev.severity as keyof typeof severityWeights] || 0;
  }
  
  // Cap at 100
  return Math.min(100, score);
}

function calculateIntegrationScore(pkgName: string, allPackages: Map<string, PackageAnalysis>): number {
  let score = 0;
  
  // Check how many packages depend on this one
  for (const [otherName, otherPkg] of allPackages) {
    if (otherName === pkgName) continue;
    
    const otherPkgJson = readPackageJson(otherPkg.path);
    if (!otherPkgJson) continue;
    
    const deps = {
      ...otherPkgJson.dependencies,
      ...otherPkgJson.devDependencies,
    };
    
    // Check if this package is referenced
    for (const depName of Object.keys(deps)) {
      if (depName === pkgName || depName.includes(pkgName.split('/').pop() || '')) {
        score += 10;
        break;
      }
    }
  }
  
  // Check CLI references
  const cliPath = join(ROOT, 'packages', 'cli');
  if (existsSync(cliPath)) {
    const cliFiles = globFiles(cliPath, '**/*.ts');
    for (const file of cliFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        if (content.includes(pkgName) || content.includes(`@isl-lang/${pkgName.split('/').pop()}`)) {
          score += 15;
          break;
        }
      } catch {}
    }
  }
  
  return Math.min(100, score);
}

function calculateUserFacingScore(pkgName: string, pkgPath: string): number {
  let score = 0;
  
  // CLI package
  if (pkgName.includes('cli') || pkgPath.includes('cli')) {
    score += 50;
  }
  
  // VSCode extension
  if (pkgName.includes('vscode') || pkgPath.includes('vscode')) {
    score += 40;
  }
  
  // Dashboard/Web
  if (pkgName.includes('dashboard') || pkgName.includes('web') || pkgPath.includes('dashboard')) {
    score += 40;
  }
  
  // Marketplace
  if (pkgName.includes('marketplace')) {
    score += 30;
  }
  
  // API Gateway
  if (pkgName.includes('api-gateway') || pkgName.includes('gateway')) {
    score += 30;
  }
  
  // Core packages (high visibility)
  const corePackages = ['parser', 'evaluator', 'verifier', 'gate', 'proof', 'pipeline'];
  for (const core of corePackages) {
    if (pkgName.includes(core)) {
      score += 20;
      break;
    }
  }
  
  return Math.min(100, score);
}

function findUpstreamDependents(pkgName: string, allPackages: Map<string, PackageAnalysis>): string[] {
  const dependents: string[] = [];
  
  for (const [otherName, otherPkg] of allPackages) {
    if (otherName === pkgName) continue;
    
    const otherPkgJson = readPackageJson(otherPkg.path);
    if (!otherPkgJson) continue;
    
    const deps = {
      ...otherPkgJson.dependencies,
      ...otherPkgJson.devDependencies,
    };
    
    for (const depName of Object.keys(deps)) {
      if (depName === pkgName || depName.includes(pkgName.split('/').pop() || '')) {
        dependents.push(otherName);
        break;
      }
    }
  }
  
  return dependents;
}

function determineTier(pkgName: string, pkgPath: string, stubScore: number): 'Tier 1' | 'Tier 2' | 'Tier 3' {
  // Tier 1: Blocks adoption (publish artifacts, CI, VSCode, verify pipeline)
  const tier1Keywords = ['cli', 'vscode', 'gate', 'verify', 'pipeline', 'ci', 'publish'];
  for (const keyword of tier1Keywords) {
    if (pkgName.includes(keyword) || pkgPath.includes(keyword)) {
      return 'Tier 1';
    }
  }
  
  // Tier 2: Platform moats (marketplace, proof, policies, security)
  const tier2Keywords = ['marketplace', 'proof', 'policy', 'security', 'auth', 'stdlib'];
  for (const keyword of tier2Keywords) {
    if (pkgName.includes(keyword) || pkgPath.includes(keyword)) {
      return 'Tier 2';
    }
  }
  
  // Default to Tier 3: breadth (extra codegen targets, optional integrations)
  return 'Tier 3';
}

function generateRecommendedActions(analysis: PackageAnalysis): string[] {
  const actions: string[] = [];
  
  if (analysis.stubScore > 50) {
    actions.push('Replace all stub implementations with real logic');
  }
  
  if (!analysis.hasTests) {
    actions.push('Add test suite (unit + integration tests)');
  }
  
  if (!analysis.hasReadme) {
    actions.push('Create README.md with usage examples');
  }
  
  if (analysis.isEmpty) {
    actions.push('Implement core exports and functionality');
  }
  
  if (analysis.stubEvidence.length > 0) {
    const criticalStubs = analysis.stubEvidence.filter(e => e.severity === 'critical');
    if (criticalStubs.length > 0) {
      actions.push(`Fix ${criticalStubs.length} critical stub(s) (throw "Not implemented")`);
    }
  }
  
  if (analysis.upstreamDependents.length > 0) {
    actions.push(`Ensure compatibility with ${analysis.upstreamDependents.length} dependent package(s)`);
  }
  
  return actions;
}

function analyzePackage(pkgPath: string, allPackages: Map<string, PackageAnalysis>): PackageAnalysis | null {
  const pkgJson = readPackageJson(pkgPath);
  if (!pkgJson || !pkgJson.name) {
    return null;
  }
  
  const pkgName = pkgJson.name;
  const stubEvidence = scanPackageForStubs(pkgPath);
  const fileChecks = checkPackageFiles(pkgPath);
  
  const stubScore = calculateStubScore(stubEvidence);
  const integrationScore = calculateIntegrationScore(pkgName, allPackages);
  const userFacingScore = calculateUserFacingScore(pkgName, pkgPath);
  
  // Priority score: weighted combination
  const priorityScore = (stubScore * 0.5) + (integrationScore * 0.3) + (userFacingScore * 0.2);
  
  const upstreamDependents = findUpstreamDependents(pkgName, allPackages);
  const tier = determineTier(pkgName, pkgPath, stubScore);
  
  const analysis: PackageAnalysis = {
    name: pkgName,
    path: relative(ROOT, pkgPath),
    stubScore,
    integrationScore,
    userFacingScore,
    priorityScore,
    stubEvidence,
    hasTests: fileChecks.hasTests,
    hasReadme: fileChecks.hasReadme,
    hasExports: fileChecks.hasExports,
    isEmpty: fileChecks.isEmpty,
    upstreamDependents,
    tier,
    recommendedActions: [],
  };
  
  analysis.recommendedActions = generateRecommendedActions(analysis);
  
  return analysis;
}

// ============================================================================
// Report Generation
// ============================================================================

function generateMarkdownReport(analyses: PackageAnalysis[]): string {
  const stubbed = analyses.filter(a => a.stubScore > 0 || a.isEmpty);
  const sorted = [...stubbed].sort((a, b) => b.priorityScore - a.priorityScore);
  
  let md = `# Stub Inventory Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `- **Total Packages Analyzed:** ${analyses.length}\n`;
  md += `- **Stubbed Packages:** ${stubbed.length}\n`;
  md += `- **Tier 1 (Blocks Adoption):** ${sorted.filter(a => a.tier === 'Tier 1').length}\n`;
  md += `- **Tier 2 (Platform Moats):** ${sorted.filter(a => a.tier === 'Tier 2').length}\n`;
  md += `- **Tier 3 (Breadth):** ${sorted.filter(a => a.tier === 'Tier 3').length}\n\n`;
  
  md += `## Priority Order (by Priority Score)\n\n`;
  
  for (const pkg of sorted) {
    md += `### ${pkg.name}\n\n`;
    md += `**Path:** \`${pkg.path}\`\n`;
    md += `**Tier:** ${pkg.tier}\n`;
    md += `**Stub Score:** ${pkg.stubScore}/100\n`;
    md += `**Integration Score:** ${pkg.integrationScore}/100\n`;
    md += `**User-Facing Score:** ${pkg.userFacingScore}/100\n`;
    md += `**Priority Score:** ${pkg.priorityScore.toFixed(1)}/100\n\n`;
    
    md += `**Status:**\n`;
    md += `- Has Tests: ${pkg.hasTests ? '✅' : '❌'}\n`;
    md += `- Has README: ${pkg.hasReadme ? '✅' : '❌'}\n`;
    md += `- Has Exports: ${pkg.hasExports ? '✅' : '❌'}\n`;
    md += `- Is Empty: ${pkg.isEmpty ? '⚠️ Yes' : '✅ No'}\n\n`;
    
    if (pkg.upstreamDependents.length > 0) {
      md += `**Upstream Dependents:** ${pkg.upstreamDependents.join(', ')}\n\n`;
    }
    
    if (pkg.stubEvidence.length > 0) {
      md += `**Stub Evidence (${pkg.stubEvidence.length} found):**\n\n`;
      for (const ev of pkg.stubEvidence.slice(0, 10)) {
        md += `- \`${ev.file}:${ev.line}\` - ${ev.severity.toUpperCase()}: ${ev.pattern}\n`;
        md += `  \`\`\`\n  ${ev.snippet}\n  \`\`\`\n`;
      }
      if (pkg.stubEvidence.length > 10) {
        md += `- ... and ${pkg.stubEvidence.length - 10} more\n`;
      }
      md += `\n`;
    }
    
    if (pkg.recommendedActions.length > 0) {
      md += `**Recommended Actions:**\n`;
      for (const action of pkg.recommendedActions) {
        md += `- ${action}\n`;
      }
      md += `\n`;
    }
    
    md += `---\n\n`;
  }
  
  return md;
}

function generateJsonReport(analyses: PackageAnalysis[]): object {
  const stubbed = analyses.filter(a => a.stubScore > 0 || a.isEmpty);
  const sorted = [...stubbed].sort((a, b) => b.priorityScore - a.priorityScore);
  
  return {
    generated: new Date().toISOString(),
    summary: {
      totalPackages: analyses.length,
      stubbedPackages: stubbed.length,
      tier1: sorted.filter(a => a.tier === 'Tier 1').length,
      tier2: sorted.filter(a => a.tier === 'Tier 2').length,
      tier3: sorted.filter(a => a.tier === 'Tier 3').length,
    },
    packages: sorted.map(pkg => ({
      name: pkg.name,
      path: pkg.path,
      tier: pkg.tier,
      scores: {
        stub: pkg.stubScore,
        integration: pkg.integrationScore,
        userFacing: pkg.userFacingScore,
        priority: pkg.priorityScore,
      },
      status: {
        hasTests: pkg.hasTests,
        hasReadme: pkg.hasReadme,
        hasExports: pkg.hasExports,
        isEmpty: pkg.isEmpty,
      },
      upstreamDependents: pkg.upstreamDependents,
      stubEvidence: pkg.stubEvidence,
      recommendedActions: pkg.recommendedActions,
    })),
  };
}

// ============================================================================
// Definition of Done Template
// ============================================================================

function generateDefinitionOfDone(): string {
  return `# Definition of Done - Package Completion Template

Every package must meet these criteria before being considered "complete":

## 1. Exports ✅
- [ ] Package has a clear entry point (index.ts/js or src/index.ts/js)
- [ ] All public APIs are exported
- [ ] Type definitions are included (.d.ts files)
- [ ] Package.json exports field is properly configured

## 2. Tests ✅
- [ ] Unit tests cover core functionality (>80% coverage)
- [ ] Integration tests for key workflows
- [ ] Tests pass in CI
- [ ] No skipped or disabled tests without justification

## 3. Documentation ✅
- [ ] README.md with:
  - Package purpose and use case
  - Installation instructions
  - Usage examples
  - API documentation (or link to docs)
- [ ] Code comments for public APIs
- [ ] JSDoc/TSDoc for exported functions/classes

## 4. Sample/Examples ✅
- [ ] At least one working example
- [ ] Example demonstrates main use case
- [ ] Example is runnable (if applicable)

## 5. Integration ✅
- [ ] Package integrates correctly with dependent packages
- [ ] No breaking changes to existing integrations
- [ ] CLI commands work (if applicable)
- [ ] VSCode extension works (if applicable)

## 6. CI ✅
- [ ] Package builds successfully
- [ ] Tests run in CI
- [ ] Type checking passes
- [ ] Linting passes
- [ ] No stub implementations in production code

## 7. No Stubs ✅
- [ ] No \`throw new Error("Not implemented")\` in production code
- [ ] No TODO/FIXME markers in core logic
- [ ] No placeholder return values (\`return null\`, \`return {}\`)
- [ ] All exported functions have real implementations

## 8. Production Ready ✅
- [ ] Error handling is implemented
- [ ] Input validation is present
- [ ] Logging uses proper logger (not console.log)
- [ ] No hardcoded secrets or credentials
- [ ] Environment variables are documented

---
*This template should be used as a checklist for each package completion.*
`;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔍 Agent 41 — Stub Hunter & Completion Orchestrator\n');
  console.log('Scanning packages...\n');
  
  const packagePaths = getAllPackages();
  console.log(`Found ${packagePaths.length} packages\n`);
  
  const allPackages = new Map<string, PackageAnalysis>();
  
  // First pass: collect all packages
  for (const pkgPath of packagePaths) {
    const pkgJson = readPackageJson(pkgPath);
    if (pkgJson?.name) {
      // Create placeholder to allow dependency resolution
      allPackages.set(pkgJson.name, {
        name: pkgJson.name,
        path: relative(ROOT, pkgPath),
        stubScore: 0,
        integrationScore: 0,
        userFacingScore: 0,
        priorityScore: 0,
        stubEvidence: [],
        hasTests: false,
        hasReadme: false,
        hasExports: false,
        isEmpty: false,
        upstreamDependents: [],
        tier: 'Tier 3',
        recommendedActions: [],
      });
    }
  }
  
  // Second pass: analyze each package
  const analyses: PackageAnalysis[] = [];
  for (const pkgPath of packagePaths) {
    const analysis = analyzePackage(pkgPath, allPackages);
    if (analysis) {
      allPackages.set(analysis.name, analysis);
      analyses.push(analysis);
      process.stdout.write('.');
    }
  }
  
  console.log('\n\nGenerating reports...\n');
  
  // Generate reports
  const reportsDir = join(ROOT, 'reports');
  if (!existsSync(reportsDir)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(reportsDir, { recursive: true });
  }
  
  const mdReport = generateMarkdownReport(analyses);
  const mdPath = join(reportsDir, 'stub-inventory.md');
  const { writeFileSync } = await import('fs');
  writeFileSync(mdPath, mdReport, 'utf-8');
  console.log(`✅ Markdown report: ${mdPath}`);
  
  const jsonReport = generateJsonReport(analyses);
  const jsonPath = join(reportsDir, 'stub-inventory.json');
  writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2) + '\n', 'utf-8');
  console.log(`✅ JSON report: ${jsonPath}`);
  
  const dodTemplate = generateDefinitionOfDone();
  const dodPath = join(reportsDir, 'definition-of-done.md');
  writeFileSync(dodPath, dodTemplate, 'utf-8');
  console.log(`✅ Definition of Done template: ${dodPath}`);
  
  const stubbed = analyses.filter(a => a.stubScore > 0 || a.isEmpty);
  console.log(`\n📊 Found ${stubbed.length} stubbed packages out of ${analyses.length} total`);
  console.log(`\n🎯 Top 10 Priority Packages:\n`);
  
  const top10 = [...stubbed].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 10);
  for (let i = 0; i < top10.length; i++) {
    const pkg = top10[i];
    console.log(`${i + 1}. ${pkg.name} (Priority: ${pkg.priorityScore.toFixed(1)}, Stub Score: ${pkg.stubScore}, Tier: ${pkg.tier})`);
  }
  
  console.log('\n✅ Inventory complete!');
}

main().catch(console.error);
