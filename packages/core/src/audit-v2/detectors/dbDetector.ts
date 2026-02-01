/**
 * Database Detector V2
 *
 * Detection of database operations, ORM usage, and related risk patterns.
 */

import type {
  DetectorResult,
  DetectedCandidate,
  RiskFlag,
  FrameworkHint,
  AuditOptionsV2,
} from '../types.js';

/**
 * Database patterns to detect
 */
const DB_PATTERNS = {
  // Prisma ORM
  prisma: {
    pattern: /prisma\s*\.\s*(\w+)\s*\.\s*(findMany|findUnique|findFirst|create|update|delete|upsert|aggregate|count)/gi,
    confidence: 0.95,
    orm: 'prisma',
  },
  // Drizzle ORM
  drizzle: {
    pattern: /(?:db|drizzle)\s*\.\s*(select|insert|update|delete)\s*\(/gi,
    confidence: 0.9,
    orm: 'drizzle',
  },
  // TypeORM
  typeorm: {
    pattern: /(?:repository|manager|connection)\s*\.\s*(find|findOne|save|insert|update|delete|createQueryBuilder)/gi,
    confidence: 0.9,
    orm: 'typeorm',
  },
  // Mongoose
  mongoose: {
    pattern: /(?:Model|mongoose)\s*\.\s*(find|findOne|findById|create|updateOne|deleteOne|aggregate)/gi,
    confidence: 0.9,
    orm: 'mongoose',
  },
  // Knex query builder
  knex: {
    pattern: /(?:knex|db)\s*\(\s*['"`]\w+['"`]\s*\)\s*\.\s*(select|insert|update|delete|where)/gi,
    confidence: 0.85,
    orm: 'knex',
  },
  // Raw SQL patterns
  rawSql: {
    pattern: /(?:query|execute|raw)\s*\(\s*['"`]\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s/gi,
    confidence: 0.8,
    orm: 'raw-sql',
  },
  // SQL template literals
  sqlTemplate: {
    pattern: /(?:sql|Prisma\.sql|Sql)\s*`[^`]*(SELECT|INSERT|UPDATE|DELETE)[^`]*`/gi,
    confidence: 0.85,
    orm: 'sql-template',
  },
  // Redis operations
  redis: {
    pattern: /(?:redis|client)\s*\.\s*(get|set|del|hget|hset|lpush|rpush|sadd|zadd)/gi,
    confidence: 0.85,
    orm: 'redis',
  },
  // Generic repository patterns
  repository: {
    pattern: /(?:repository|repo)\s*\.\s*(find|save|delete|create|update|getBy)/gi,
    confidence: 0.7,
    orm: 'generic',
  },
};

/**
 * Detect database operations in file content
 */
export function detectDatabase(
  content: string,
  filePath: string,
  options: AuditOptionsV2
): DetectorResult {
  const candidates: DetectedCandidate[] = [];
  const riskFlags: RiskFlag[] = [];
  const frameworkHints: FrameworkHint[] = [];
  const lines = content.split('\n');

  // Track detected lines to avoid duplicates
  const detectedLines: Set<number> = new Set();

  for (const [patternName, patternConfig] of Object.entries(DB_PATTERNS)) {
    const { pattern, confidence, orm } = patternConfig;
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);

      // Skip if confidence below threshold or already detected
      if (confidence < (options.minConfidence ?? 0.4)) continue;
      if (detectedLines.has(line)) continue;

      detectedLines.add(line);

      const operation = match[2] || match[1] || 'query';
      const model = match[1] || 'unknown';

      const candidate: DetectedCandidate = {
        id: `db-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}-${line}`,
        category: 'database',
        name: `${orm}: ${operation}${model !== operation ? ` (${model})` : ''}`,
        filePath,
        line,
        endLine: findStatementEnd(lines, line - 1),
        snippet: options.includeSnippets
          ? extractSnippet(lines, line - 1, options.maxSnippetLines ?? 10)
          : undefined,
        confidence,
        functionName: extractFunctionName(lines, line - 1),
        metadata: {
          orm,
          operation,
          model,
          patternType: patternName,
        },
      };

      candidates.push(candidate);

      // Check for database-related risks
      const contextContent = extractContext(lines, line - 1, 20);
      const dbRisks = detectDatabaseRisks(
        contextContent,
        candidate,
        filePath,
        line,
        orm,
        match[0]
      );
      riskFlags.push(...dbRisks);
    }
  }

  return {
    candidates,
    riskFlags,
    frameworkHints,
  };
}

/**
 * Detect database-related risk flags
 */
function detectDatabaseRisks(
  contextContent: string,
  candidate: DetectedCandidate,
  filePath: string,
  line: number,
  orm: string,
  matchedText: string
): RiskFlag[] {
  const risks: RiskFlag[] = [];

  // Check for SQL injection risk in raw queries
  if (orm === 'raw-sql' || orm === 'sql-template') {
    // Check for string concatenation or template literals with variables
    if (/\$\{|\+\s*\w+\s*\+|`[^`]*\$\{/i.test(contextContent)) {
      risks.push({
        id: `risk-sql-injection-${candidate.id}`,
        category: 'sql-injection-risk',
        severity: 'critical',
        description: `Possible SQL injection risk in raw query near ${candidate.name}`,
        filePath,
        line,
        suggestion: 'Use parameterized queries or ORM methods instead of string concatenation',
        relatedCandidates: [candidate.id],
      });
    }
  }

  // Check for missing transaction in multi-operation context
  const hasMultipleOps =
    (contextContent.match(/\.(create|update|delete|insert|save)/gi) || []).length > 1;
  const hasTransaction =
    /(?:transaction|\$transaction|startTransaction|beginTransaction)/i.test(contextContent);

  if (hasMultipleOps && !hasTransaction) {
    risks.push({
      id: `risk-no-transaction-${candidate.id}`,
      category: 'db-without-transaction',
      severity: 'info',
      description: `Multiple database operations without visible transaction near ${candidate.name}`,
      filePath,
      line,
      suggestion: 'Consider wrapping multiple operations in a transaction for data consistency',
      relatedCandidates: [candidate.id],
    });
  }

  // Check for unhandled errors
  const hasErrorHandling =
    /(?:try\s*\{|\.catch\s*\(|catch\s*\()/i.test(contextContent);

  if (!hasErrorHandling) {
    risks.push({
      id: `risk-unhandled-db-error-${candidate.id}`,
      category: 'unhandled-error',
      severity: 'info',
      description: `Database operation ${candidate.name} may have unhandled errors`,
      filePath,
      line,
      suggestion: 'Add try/catch or .catch() to handle database errors gracefully',
      relatedCandidates: [candidate.id],
    });
  }

  return risks;
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Find end of a statement (looking for semicolon or closing bracket)
 */
function findStatementEnd(lines: string[], startLineIndex: number): number {
  let parenCount = 0;
  let bracketCount = 0;

  for (let i = startLineIndex; i < Math.min(lines.length, startLineIndex + 20); i++) {
    const line = lines[i] || '';
    for (const char of line) {
      if (char === '(') parenCount++;
      else if (char === ')') parenCount--;
      else if (char === '{') bracketCount++;
      else if (char === '}') bracketCount--;
    }

    // Statement ends when all parens/brackets are closed and we hit ; or end of expression
    if (parenCount <= 0 && bracketCount <= 0 && (line.includes(';') || line.trim().endsWith(')'))) {
      return i + 1;
    }
  }

  return Math.min(startLineIndex + 10, lines.length);
}

/**
 * Extract function name near a line
 */
function extractFunctionName(lines: string[], lineIndex: number): string | undefined {
  for (let i = lineIndex; i >= Math.max(0, lineIndex - 10); i--) {
    const line = lines[i] || '';
    const match = line.match(/(?:function|const|let|async function|async)\s+(\w+)/);
    if (match) {
      return match[1];
    }
    const methodMatch = line.match(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{?$/);
    if (methodMatch && !['if', 'for', 'while', 'switch'].includes(methodMatch[1] || '')) {
      return methodMatch[1];
    }
  }
  return undefined;
}

/**
 * Extract code snippet
 */
function extractSnippet(
  lines: string[],
  startLineIndex: number,
  maxLines: number
): string {
  const endIndex = Math.min(startLineIndex + maxLines, lines.length);
  return lines.slice(startLineIndex, endIndex).join('\n');
}

/**
 * Extract context around a line
 */
function extractContext(
  lines: string[],
  lineIndex: number,
  contextSize: number
): string {
  const start = Math.max(0, lineIndex - 3);
  const end = Math.min(lines.length, lineIndex + contextSize);
  return lines.slice(start, end).join('\n');
}

/**
 * Check if a file is likely to contain database operations
 */
export function isDatabaseFile(filePath: string): boolean {
  const dbPatterns = [
    /repository/i,
    /service/i,
    /model/i,
    /entity/i,
    /schema/i,
    /migration/i,
    /seed/i,
    /database/i,
    /db/i,
    /prisma/i,
    /drizzle/i,
  ];

  return dbPatterns.some(p => p.test(filePath));
}
