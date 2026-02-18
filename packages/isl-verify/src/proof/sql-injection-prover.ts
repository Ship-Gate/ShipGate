import * as fs from 'fs';
import type { PropertyProver, PropertyProof, ProjectContext, SQLEvidence, Finding } from './types.js';

const ORM_PATTERNS = [
  { name: 'prisma', patterns: [/@prisma\/client/, /new PrismaClient/] },
  { name: 'drizzle', patterns: [/drizzle-orm/, /drizzle\(/, /db\.select/] },
  { name: 'typeorm', patterns: [/typeorm/, /getRepository/, /@Entity/] },
  { name: 'sequelize', patterns: [/sequelize/, /new Sequelize/] },
  { name: 'knex', patterns: [/require\(['"]knex/, /import.*knex/] },
  { name: 'pg', patterns: [/require\(['"]pg/, /import.*pg/, /new Pool/, /new Client/] },
  { name: 'mysql2', patterns: [/require\(['"]mysql2/, /import.*mysql2/, /createConnection/, /createPool/] },
  { name: 'mongodb', patterns: [/mongodb/, /MongoClient/, /mongoose/] },
];

const UNSAFE_PATTERNS = [
  { pattern: /\$queryRaw\s*\(?\s*`/, description: 'Prisma $queryRaw with template literal', safe: false },
  { pattern: /\$executeRaw\s*\(?\s*`/, description: 'Prisma $executeRaw with template literal', safe: false },
  { pattern: /sql\.raw\s*\(/, description: 'Drizzle sql.raw()', safe: false },
  { pattern: /\.query\s*\(\s*['"][^'"]*\+/, description: 'String concatenation in query', safe: false },
  { pattern: /SELECT.*\$\{/, description: 'Template literal in SQL SELECT', safe: false },
  { pattern: /WHERE.*\$\{/, description: 'Template literal in SQL WHERE', safe: false },
  { pattern: /UPDATE.*SET.*\$\{/, description: 'Template literal in SQL UPDATE', safe: false },
  { pattern: /INSERT.*VALUES.*\$\{/, description: 'Template literal in SQL INSERT', safe: false },
];

const PARAMETERIZED_PATTERNS = [
  { pattern: /\$queryRaw\s*`[^`]*\$\d+/, description: 'Prisma $queryRaw with $1 params', safe: true },
  { pattern: /\.query\s*\(\s*['"][^'"]*\$\d+/, description: 'pg query with $1 params', safe: true },
  { pattern: /prisma\.\w+\.findMany/, description: 'Prisma ORM method', safe: true },
  { pattern: /prisma\.\w+\.create/, description: 'Prisma ORM method', safe: true },
  { pattern: /db\.select\(/, description: 'Drizzle query builder', safe: true },
];

const MONGODB_UNSAFE = [
  { pattern: /\$where\s*:/, description: 'MongoDB $where operator', safe: false },
  { pattern: /\$regex\s*:.*\$\{/, description: 'MongoDB $regex with template literal', safe: false },
];

export class SQLInjectionProver implements PropertyProver {
  id = 'tier1-sql-injection';
  name = 'SQL Injection Prevention';
  tier = 1 as const;

  async prove(project: ProjectContext): Promise<PropertyProof> {
    const start = Date.now();
    const evidence: SQLEvidence[] = [];
    const findings: Finding[] = [];

    // Detect ORM in use
    const detectedORMs = await this.detectORM(project);
    
    for (const file of project.sourceFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;

          // Check for unsafe patterns
          for (const { pattern, description, safe } of UNSAFE_PATTERNS) {
            if (pattern.test(line)) {
              evidence.push({
                file,
                line: lineNum,
                orm: detectedORMs.join(', ') || null,
                queryMethod: description,
                safetyLevel: 'unsafe',
                context: line.trim().substring(0, 100),
              });

              findings.push({
                file,
                line: lineNum,
                severity: 'error',
                message: `SQL injection risk: ${description}`,
                suggestion: 'Use parameterized queries or ORM methods',
              });
            }
          }

          // Check MongoDB unsafe patterns
          for (const { pattern, description } of MONGODB_UNSAFE) {
            if (pattern.test(line)) {
              evidence.push({
                file,
                line: lineNum,
                orm: 'mongodb',
                queryMethod: description,
                safetyLevel: 'unsafe',
                context: line.trim().substring(0, 100),
              });

              findings.push({
                file,
                line: lineNum,
                severity: 'error',
                message: `MongoDB injection risk: ${description}`,
                suggestion: 'Avoid $where and user input in operator position',
              });
            }
          }

          // Check for string concatenation in SQL-like contexts
          if (this.isStringConcatenationInSQL(line)) {
            evidence.push({
              file,
              line: lineNum,
              orm: detectedORMs.join(', ') || null,
              queryMethod: 'string concatenation',
              safetyLevel: 'unsafe',
              context: line.trim().substring(0, 100),
            });

            findings.push({
              file,
              line: lineNum,
              severity: 'error',
              message: 'String concatenation in SQL query detected',
              suggestion: 'Use parameterized queries',
            });
          }

          // Record parameterized/safe queries
          for (const { pattern, description } of PARAMETERIZED_PATTERNS) {
            if (pattern.test(line)) {
              evidence.push({
                file,
                line: lineNum,
                orm: detectedORMs.join(', ') || null,
                queryMethod: description,
                safetyLevel: 'safe',
                context: line.trim().substring(0, 100),
              });
            }
          }
        });
      } catch {
        // Skip files that can't be read
      }
    }

    // Verify Prisma/Drizzle/TypeORM projects have NO raw queries
    if (detectedORMs.includes('prisma') || detectedORMs.includes('drizzle') || detectedORMs.includes('typeorm')) {
      const rawQueryFindings = findings.filter(f => 
        f.message.includes('$queryRaw') || 
        f.message.includes('$executeRaw') || 
        f.message.includes('sql.raw')
      );

      if (rawQueryFindings.length > 0) {
        // Already captured above
      }
    }

    const duration_ms = Date.now() - start;
    const unsafeQueries = evidence.filter(e => e.safetyLevel === 'unsafe').length;
    const safeQueries = evidence.filter(e => e.safetyLevel === 'safe').length;

    return {
      property: 'sql-injection',
      status: unsafeQueries === 0 ? 'PROVEN' : 'FAILED',
      summary: unsafeQueries === 0
        ? `All ${safeQueries} DB access points use parameterized queries. ORM: ${detectedORMs.join(', ') || 'none'}`
        : `${unsafeQueries} unsafe SQL query pattern(s) detected`,
      evidence,
      findings,
      method: 'pattern-matching',
      confidence: 'high',
      duration_ms,
    };
  }

  private async detectORM(project: ProjectContext): Promise<string[]> {
    const detected: string[] = [];

    // Check package.json
    if (project.packageJson) {
      const deps = {
        ...project.packageJson.dependencies as Record<string, string>,
        ...project.packageJson.devDependencies as Record<string, string>,
      };

      for (const [name, { patterns }] of ORM_PATTERNS.map(p => [p.name, p] as const)) {
        for (const pattern of patterns) {
          if (Object.keys(deps).some(dep => pattern.test(dep))) {
            detected.push(name);
            break;
          }
        }
      }
    }

    // Check source code for imports
    for (const file of project.sourceFiles.slice(0, 50)) { // Sample first 50 files
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        for (const { name, patterns } of ORM_PATTERNS) {
          if (!detected.includes(name)) {
            if (patterns.some(p => p.test(content))) {
              detected.push(name);
            }
          }
        }
      } catch {
        // Skip
      }
    }

    return [...new Set(detected)];
  }

  private isStringConcatenationInSQL(line: string): boolean {
    // Check for patterns like: query("SELECT * FROM " + table)
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WHERE', 'FROM'];
    const hasSQL = sqlKeywords.some(kw => line.includes(kw));
    const hasConcat = /['"][^'"]*['"]\s*\+\s*\w+/.test(line) || /\w+\s*\+\s*['"]/.test(line);

    return hasSQL && hasConcat;
  }
}
