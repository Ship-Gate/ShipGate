/**
 * Java resolver — Maven/Gradle-aware dependency checks and ghost import detection
 *
 * Detects:
 * - Missing dependencies (used in code but not in pom.xml / build.gradle)
 * - Phantom packages (no build config found at all)
 * - Deprecated/renamed packages
 * - Wildcard imports that hide actual dependency usage
 *
 * @module @isl-lang/hallucination-scanner/java/resolver
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type {
  JavaImport,
  JavaFinding,
  JavaBuildConfig,
  JavaDependencyCheckResult,
  MavenDependency,
  GradleDependency,
  SourceLocation,
} from './types.js';

export interface JavaResolverOptions {
  projectRoot: string;
  /** Optional entry files; otherwise discovers all .java files */
  entries?: string[] | undefined;
  /** Custom file reader (for testing) */
  readFile?: ((filePath: string) => Promise<string>) | undefined;
  /** Custom file existence check (for testing) */
  fileExists?: ((filePath: string) => Promise<boolean>) | undefined;
  /** Custom pom.xml content (for testing) */
  pomXmlContent?: string | undefined;
  /** Custom build.gradle content (for testing) */
  buildGradleContent?: string | undefined;
}

// ---- JDK stdlib prefixes ----

const JDK_PREFIXES = [
  'java.',
  'javax.',
  'jdk.',
  'sun.',
  'com.sun.',
  'org.xml.sax',
  'org.w3c.dom',
  'org.ietf.jgss',
];

function isJdkStdlib(importPath: string): boolean {
  return JDK_PREFIXES.some(prefix => importPath.startsWith(prefix));
}

// ---- Known group-to-package mappings ----

const KNOWN_PACKAGE_GROUPS: Record<string, { groupId: string; artifactId: string }> = {
  'com.google.gson': { groupId: 'com.google.code.gson', artifactId: 'gson' },
  'com.google.common': { groupId: 'com.google.guava', artifactId: 'guava' },
  'com.google.inject': { groupId: 'com.google.inject', artifactId: 'guice' },
  'com.fasterxml.jackson': { groupId: 'com.fasterxml.jackson.core', artifactId: 'jackson-databind' },
  'org.apache.commons.lang3': { groupId: 'org.apache.commons', artifactId: 'commons-lang3' },
  'org.apache.commons.io': { groupId: 'commons-io', artifactId: 'commons-io' },
  'org.apache.commons.codec': { groupId: 'commons-codec', artifactId: 'commons-codec' },
  'org.apache.http': { groupId: 'org.apache.httpcomponents', artifactId: 'httpclient' },
  'org.slf4j': { groupId: 'org.slf4j', artifactId: 'slf4j-api' },
  'ch.qos.logback': { groupId: 'ch.qos.logback', artifactId: 'logback-classic' },
  'org.junit.jupiter': { groupId: 'org.junit.jupiter', artifactId: 'junit-jupiter' },
  'org.junit': { groupId: 'junit', artifactId: 'junit' },
  'org.mockito': { groupId: 'org.mockito', artifactId: 'mockito-core' },
  'org.springframework': { groupId: 'org.springframework', artifactId: 'spring-context' },
  'org.hibernate': { groupId: 'org.hibernate', artifactId: 'hibernate-core' },
  'io.netty': { groupId: 'io.netty', artifactId: 'netty-all' },
  'com.squareup.okhttp3': { groupId: 'com.squareup.okhttp3', artifactId: 'okhttp' },
  'com.squareup.retrofit2': { groupId: 'com.squareup.retrofit2', artifactId: 'retrofit' },
  'org.projectlombok': { groupId: 'org.projectlombok', artifactId: 'lombok' },
  'io.micrometer': { groupId: 'io.micrometer', artifactId: 'micrometer-core' },
  'org.apache.kafka': { groupId: 'org.apache.kafka', artifactId: 'kafka-clients' },
  'com.rabbitmq': { groupId: 'com.rabbitmq', artifactId: 'amqp-client' },
  'redis.clients': { groupId: 'redis.clients', artifactId: 'jedis' },
  'io.lettuce': { groupId: 'io.lettuce', artifactId: 'lettuce-core' },
};

const DEPRECATED_PACKAGES: Record<string, string> = {
  'org.apache.commons.lang.': 'Renamed to org.apache.commons.lang3 — update to commons-lang3',
  'junit.framework.': 'Legacy JUnit 3 — migrate to org.junit.jupiter (JUnit 5)',
  'org.apache.commons.logging.': 'Superseded by SLF4J — migrate to org.slf4j',
  'com.google.common.base.Optional': 'Use java.util.Optional (JDK 8+) instead of Guava Optional',
  'javax.servlet.': 'Renamed to jakarta.servlet in Jakarta EE 9+ — update namespace',
  'javax.persistence.': 'Renamed to jakarta.persistence in Jakarta EE 9+ — update namespace',
  'javax.inject.': 'Consider using jakarta.inject for Jakarta EE 9+ compatibility',
};

// ---- Build config parsing ----

function parsePomXml(content: string): JavaBuildConfig {
  const dependencies: MavenDependency[] = [];
  const declaredGroups = new Set<string>();

  const depRegex = /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>(?:\s*<version>([^<]*)<\/version>)?(?:\s*<scope>([^<]*)<\/scope>)?/g;
  let match: RegExpExecArray | null;

  while ((match = depRegex.exec(content)) !== null) {
    const groupId = match[1]!.trim();
    const artifactId = match[2]!.trim();
    const version = match[3]?.trim();
    const scope = match[4]?.trim();

    dependencies.push({ groupId, artifactId, version, scope });
    declaredGroups.add(groupId);
    declaredGroups.add(`${groupId}.${artifactId}`);
  }

  return { type: 'maven', dependencies, declaredGroups };
}

function parseBuildGradle(content: string): JavaBuildConfig {
  const dependencies: GradleDependency[] = [];
  const declaredGroups = new Set<string>();

  // Match: implementation 'group:name:version'  or  implementation "group:name:version"
  const shortRegex = /(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly|annotationProcessor)\s+['"]([^:'"]+):([^:'"]+)(?::([^'"]+))?['"]/g;
  let match: RegExpExecArray | null;

  while ((match = shortRegex.exec(content)) !== null) {
    const group = match[1]!.trim();
    const name = match[2]!.trim();
    const version = match[3]?.trim();
    const configuration = content.substring(
      content.lastIndexOf('\n', match.index) + 1,
      match.index
    ).trim().split(/\s+/)[0] || 'implementation';

    dependencies.push({ configuration, group, name, version });
    declaredGroups.add(group);
    declaredGroups.add(`${group}.${name}`);
  }

  // Match: implementation group: 'x', name: 'y', version: 'z'
  const mapRegex = /(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s+group\s*:\s*['"]([^'"]+)['"],\s*name\s*:\s*['"]([^'"]+)['"](?:,\s*version\s*:\s*['"]([^'"]+)['"])?/g;

  while ((match = mapRegex.exec(content)) !== null) {
    const group = match[1]!.trim();
    const name = match[2]!.trim();
    const version = match[3]?.trim();

    dependencies.push({ configuration: 'implementation', group, name, version });
    declaredGroups.add(group);
    declaredGroups.add(`${group}.${name}`);
  }

  return { type: 'gradle', dependencies, declaredGroups };
}

// ---- Import extraction ----

interface RawImport {
  path: string;
  isStatic: boolean;
  isWildcard: boolean;
  line: number;
  column: number;
  raw: string;
}

function extractJavaImports(source: string, _filePath: string): RawImport[] {
  const imports: RawImport[] = [];
  const lines = source.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const trimmed = line.trim();

    if (trimmed.startsWith('class ') || trimmed.startsWith('public class ') ||
        trimmed.startsWith('interface ') || trimmed.startsWith('public interface ') ||
        trimmed.startsWith('enum ') || trimmed.startsWith('public enum ') ||
        trimmed.startsWith('@')) {
      if (!trimmed.startsWith('import')) break;
    }

    const match = trimmed.match(/^import\s+(static\s+)?([A-Za-z_][\w.]*(?:\.\*)?)\s*;/);
    if (!match) continue;

    const isStatic = !!match[1];
    const importPath = match[2]!;
    const isWildcard = importPath.endsWith('.*');
    const col = line.indexOf('import') + 1;

    imports.push({
      path: importPath,
      isStatic,
      isWildcard,
      line: lineIdx + 1,
      column: col,
      raw: trimmed,
    });
  }

  return imports;
}

/**
 * Extract a "package group" from a fully qualified import path.
 * e.g. "com.google.gson.Gson" -> "com.google.gson"
 *      "org.apache.commons.lang3.StringUtils" -> "org.apache.commons.lang3"
 */
function extractPackageGroup(importPath: string): string {
  const clean = importPath.endsWith('.*')
    ? importPath.slice(0, -2)
    : importPath;

  const parts = clean.split('.');
  if (parts.length <= 1) return clean;

  // For org.xxx.yyy.ClassName -> org.xxx.yyy
  // Heuristic: the last segment starting with uppercase is a class name
  const lastPart = parts[parts.length - 1]!;
  if (lastPart[0] === lastPart[0]?.toUpperCase() && lastPart[0] !== lastPart[0]?.toLowerCase()) {
    return parts.slice(0, -1).join('.');
  }

  return clean;
}

/**
 * Find the best matching known group for an import path.
 */
function findKnownGroup(importPath: string): { groupId: string; artifactId: string } | null {
  for (const [prefix, info] of Object.entries(KNOWN_PACKAGE_GROUPS)) {
    if (importPath.startsWith(prefix)) {
      return info;
    }
  }
  return null;
}

// ---- File discovery ----

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'target', '.gradle', '.idea', 'out', 'bin']);

async function discoverJavaFiles(projectRoot: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.name.endsWith('.java')) {
        results.push(fullPath);
      }
    }
  }

  await walk(projectRoot);
  return results;
}

// ---- Main resolver ----

/**
 * Run the full Java resolver: load pom.xml or build.gradle, parse Java files,
 * detect missing dependencies, phantom packages, deprecated imports, and compute trust score.
 */
export async function resolveJava(options: JavaResolverOptions): Promise<JavaDependencyCheckResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const readFileFn = options.readFile ?? ((p: string) => fs.readFile(p, 'utf-8'));
  const fileExistsFn = options.fileExists ?? (async (p: string) => {
    try { await fs.access(p); return true; } catch { return false; }
  });

  // 1. Load build config (Maven or Gradle)
  let buildConfig: JavaBuildConfig | null = null;

  if (options.pomXmlContent) {
    buildConfig = parsePomXml(options.pomXmlContent);
  } else if (options.buildGradleContent) {
    buildConfig = parseBuildGradle(options.buildGradleContent);
  } else {
    const pomPath = path.join(projectRoot, 'pom.xml');
    const gradlePath = path.join(projectRoot, 'build.gradle');
    const gradleKtsPath = path.join(projectRoot, 'build.gradle.kts');

    if (await fileExistsFn(pomPath)) {
      const content = await readFileFn(pomPath);
      buildConfig = parsePomXml(content);
    } else if (await fileExistsFn(gradlePath)) {
      const content = await readFileFn(gradlePath);
      buildConfig = parseBuildGradle(content);
    } else if (await fileExistsFn(gradleKtsPath)) {
      const content = await readFileFn(gradleKtsPath);
      buildConfig = parseBuildGradle(content);
    }
  }

  const declaredGroups = buildConfig?.declaredGroups ?? new Set<string>();

  // 2. Discover and parse Java files
  const files = options.entries ?? await discoverJavaFiles(projectRoot);
  const allImports: JavaImport[] = [];
  const findings: JavaFinding[] = [];
  const seenGroups = new Set<string>();
  const reportedPaths = new Set<string>();

  for (const file of files) {
    let source: string;
    try {
      source = await readFileFn(file);
    } catch {
      continue;
    }

    const rawImports = extractJavaImports(source, file);

    for (const raw of rawImports) {
      const location: SourceLocation = {
        file,
        line: raw.line,
        column: raw.column,
      };

      const pkgGroup = extractPackageGroup(raw.path);
      const knownInfo = findKnownGroup(raw.path);

      const javaImport: JavaImport = {
        path: raw.path,
        isStdlib: isJdkStdlib(raw.path),
        isWildcard: raw.isWildcard,
        isStatic: raw.isStatic,
        groupId: knownInfo?.groupId ?? pkgGroup,
        artifactHint: knownInfo?.artifactId,
        location,
        raw: raw.raw,
      };
      allImports.push(javaImport);

      // Skip JDK stdlib
      if (javaImport.isStdlib) continue;

      // ---- A) Check for deprecated packages ----
      for (const [prefix, message] of Object.entries(DEPRECATED_PACKAGES)) {
        if (raw.path.startsWith(prefix) && !reportedPaths.has(prefix)) {
          reportedPaths.add(prefix);
          findings.push({
            kind: 'deprecated_package',
            message: `Import "${raw.path}" uses a deprecated package: ${message}`,
            importPath: raw.path,
            location,
            suggestion: message,
          });
          break;
        }
      }

      // ---- B) Wildcard import warning ----
      if (raw.isWildcard && !reportedPaths.has(`wildcard:${pkgGroup}`)) {
        reportedPaths.add(`wildcard:${pkgGroup}`);
        findings.push({
          kind: 'wildcard_import',
          message: `Wildcard import "${raw.path}" hides actual class dependencies`,
          importPath: raw.path,
          location,
          suggestion: `Replace with explicit imports to improve dependency traceability`,
        });
      }

      // ---- C) Check against build config ----
      seenGroups.add(pkgGroup);

      if (!buildConfig) {
        if (!reportedPaths.has(pkgGroup)) {
          reportedPaths.add(pkgGroup);
          findings.push({
            kind: 'phantom_package',
            message: `Package "${pkgGroup}" cannot be verified — no pom.xml or build.gradle found`,
            importPath: raw.path,
            groupId: knownInfo?.groupId,
            artifactId: knownInfo?.artifactId,
            location,
            suggestion: knownInfo
              ? `Add dependency: ${knownInfo.groupId}:${knownInfo.artifactId}`
              : `Initialize the project with Maven or Gradle`,
          });
        }
        continue;
      }

      // Check if any declared group matches this import's package prefix
      const isDeclared = isGroupDeclared(raw.path, pkgGroup, declaredGroups);
      if (!isDeclared && !reportedPaths.has(pkgGroup)) {
        reportedPaths.add(pkgGroup);

        if (knownInfo) {
          findings.push({
            kind: 'missing_dependency',
            message: `Package "${pkgGroup}" is used but "${knownInfo.groupId}:${knownInfo.artifactId}" is not declared in ${buildConfig.type === 'maven' ? 'pom.xml' : 'build.gradle'}`,
            importPath: raw.path,
            groupId: knownInfo.groupId,
            artifactId: knownInfo.artifactId,
            location,
            suggestion: buildConfig.type === 'maven'
              ? `Add to pom.xml:\n<dependency>\n  <groupId>${knownInfo.groupId}</groupId>\n  <artifactId>${knownInfo.artifactId}</artifactId>\n</dependency>`
              : `Add to build.gradle:\nimplementation '${knownInfo.groupId}:${knownInfo.artifactId}:<version>'`,
          });
        } else {
          findings.push({
            kind: 'missing_dependency',
            message: `Package "${pkgGroup}" is used in code but no matching dependency found in ${buildConfig.type === 'maven' ? 'pom.xml' : 'build.gradle'}`,
            importPath: raw.path,
            groupId: pkgGroup,
            location,
            suggestion: `Add the dependency for "${pkgGroup}" to your build configuration`,
          });
        }
      }
    }
  }

  const missingGroups = Array.from(seenGroups).filter(g => !isGroupDeclared('', g, declaredGroups));
  const trustScore = computeTrustScore(findings);

  return {
    success: findings.length === 0,
    buildConfig,
    imports: allImports,
    findings,
    declaredGroups,
    missingGroups,
    trustScore,
  };
}

/**
 * Check if a package group is covered by any declared dependency group.
 */
function isGroupDeclared(importPath: string, pkgGroup: string, declaredGroups: Set<string>): boolean {
  if (declaredGroups.has(pkgGroup)) return true;

  for (const declared of declaredGroups) {
    if (pkgGroup.startsWith(declared + '.') || pkgGroup.startsWith(declared)) {
      return true;
    }
    if (importPath && importPath.startsWith(declared + '.')) {
      return true;
    }
  }

  return false;
}

/**
 * Compute 0-100 trust score from findings (100 = no issues)
 */
function computeTrustScore(findings: JavaFinding[]): number {
  if (findings.length === 0) return 100;

  let penalty = 0;
  for (const f of findings) {
    switch (f.kind) {
      case 'missing_dependency':
        penalty += 25;
        break;
      case 'phantom_package':
        penalty += 30;
        break;
      case 'deprecated_package':
        penalty += 10;
        break;
      case 'wildcard_import':
        penalty += 5;
        break;
      case 'unknown_package':
        penalty += 15;
        break;
      default:
        penalty += 15;
    }
  }

  return Math.max(0, Math.min(100, 100 - penalty));
}

// ---- Single file scan ----

/**
 * Scan a single Java file; returns imports and optional dependency check
 * if pom.xml or build.gradle is found in the project.
 */
export async function scanJavaFile(
  filePath: string,
  content: string,
  options?: { projectRoot?: string },
): Promise<{
  imports: JavaImport[];
  findings: JavaFinding[];
  checkResult?: JavaDependencyCheckResult;
}> {
  const projectRoot = options?.projectRoot ?? path.dirname(filePath);

  const checkResult = await resolveJava({
    projectRoot,
    entries: [filePath],
    readFile: async (p) =>
      path.normalize(p) === path.normalize(filePath)
        ? content
        : fs.readFile(p, 'utf-8'),
    fileExists: async (p) => {
      if (path.normalize(p) === path.normalize(filePath)) return true;
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    },
  });

  return {
    imports: checkResult.imports,
    findings: checkResult.findings,
    checkResult,
  };
}
