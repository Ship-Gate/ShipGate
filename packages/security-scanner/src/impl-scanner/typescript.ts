// ============================================================================
// TypeScript Implementation Scanner
// Scans TypeScript/JavaScript source code for security vulnerabilities
// ============================================================================

import { Finding } from '../severity';

// ============================================================================
// Scanner Interface
// ============================================================================

export interface TypeScriptScanResult {
  findings: Finding[];
  linesScanned: number;
  patternsMatched: number;
}

export interface TypeScriptScanOptions {
  checkSqlInjection?: boolean;
  checkCommandInjection?: boolean;
  checkInsecureRandom?: boolean;
  checkHardcodedSecrets?: boolean;
  checkWeakCrypto?: boolean;
  checkXss?: boolean;
  checkPathTraversal?: boolean;
  checkInsecureDeserialize?: boolean;
}

const DEFAULT_OPTIONS: TypeScriptScanOptions = {
  checkSqlInjection: true,
  checkCommandInjection: true,
  checkInsecureRandom: true,
  checkHardcodedSecrets: true,
  checkWeakCrypto: true,
  checkXss: true,
  checkPathTraversal: true,
  checkInsecureDeserialize: true,
};

// ============================================================================
// Vulnerability Patterns
// ============================================================================

interface VulnerabilityPattern {
  id: string;
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  cwe: string;
  owasp: string;
  description: string;
  recommendation: string;
  fix?: string;
}

const TYPESCRIPT_PATTERNS: VulnerabilityPattern[] = [
  // SQL Injection
  {
    id: 'TS001',
    name: 'SQL Injection via String Concatenation',
    pattern: /(?:query|execute|raw)\s*\(\s*["'`](?:SELECT|INSERT|UPDATE|DELETE|DROP).+["'`]\s*\+/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL query built using string concatenation',
    recommendation: 'Use parameterized queries or an ORM',
    fix: `// Use parameterized query:\nawait db.query('SELECT * FROM users WHERE id = $1', [userId]);`,
  },
  {
    id: 'TS002',
    name: 'SQL Injection via Template Literal',
    pattern: /(?:query|execute|raw)\s*\(\s*`(?:SELECT|INSERT|UPDATE|DELETE).+\$\{/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL query built using template literals with interpolation',
    recommendation: 'Use parameterized queries instead of template literals',
  },

  // Command Injection
  {
    id: 'TS003',
    name: 'Command Injection via exec',
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*(?:["'`].+["'`]\s*\+|`.+\$\{)/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    description: 'Shell command execution with user input',
    recommendation: 'Use spawn with array arguments and shell: false',
    fix: `// Use safe spawn:\nspawn('command', [arg1, arg2], { shell: false });`,
  },
  {
    id: 'TS004',
    name: 'Dangerous eval Usage',
    pattern: /\beval\s*\(/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-95',
    owasp: 'A03:2021',
    description: 'eval() can execute arbitrary code',
    recommendation: 'Avoid eval(); use JSON.parse() for data or Function constructor as last resort',
  },
  {
    id: 'TS005',
    name: 'Dangerous Function Constructor',
    pattern: /new\s+Function\s*\(/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-95',
    owasp: 'A03:2021',
    description: 'Function constructor can execute arbitrary code',
    recommendation: 'Avoid dynamic code execution',
  },

  // Insecure Randomness
  {
    id: 'TS006',
    name: 'Insecure Random Number Generation',
    pattern: /Math\.random\s*\(\s*\)/g,
    severity: 'medium',
    category: 'cryptography',
    cwe: 'CWE-330',
    owasp: 'A02:2021',
    description: 'Math.random() is not cryptographically secure',
    recommendation: 'Use crypto.randomBytes() or crypto.randomUUID()',
    fix: `import { randomBytes, randomUUID } from 'crypto';\nconst secureToken = randomBytes(32).toString('hex');`,
  },

  // Weak Cryptography
  {
    id: 'TS007',
    name: 'Weak Hash Algorithm (MD5)',
    pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/gi,
    severity: 'high',
    category: 'cryptography',
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    description: 'MD5 is cryptographically broken',
    recommendation: 'Use SHA-256 or stronger',
  },
  {
    id: 'TS008',
    name: 'Weak Hash Algorithm (SHA-1)',
    pattern: /createHash\s*\(\s*['"]sha1['"]\s*\)/gi,
    severity: 'medium',
    category: 'cryptography',
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    description: 'SHA-1 is deprecated and should not be used for security',
    recommendation: 'Use SHA-256 or stronger',
  },

  // XSS
  {
    id: 'TS009',
    name: 'Potential XSS via innerHTML',
    pattern: /\.innerHTML\s*=\s*(?:[^'"]+\+|`[^`]*\$\{)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-79',
    owasp: 'A03:2021',
    description: 'innerHTML assignment with dynamic content',
    recommendation: 'Use textContent or sanitize HTML',
  },
  {
    id: 'TS010',
    name: 'Potential XSS via document.write',
    pattern: /document\.write\s*\(/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-79',
    owasp: 'A03:2021',
    description: 'document.write can introduce XSS',
    recommendation: 'Use DOM manipulation methods instead',
  },
  {
    id: 'TS011',
    name: 'Dangerous HTML Rendering',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/gi,
    severity: 'medium',
    category: 'injection',
    cwe: 'CWE-79',
    owasp: 'A03:2021',
    description: 'React dangerouslySetInnerHTML bypasses XSS protection',
    recommendation: 'Sanitize input or use a sanitization library like DOMPurify',
  },

  // Path Traversal
  {
    id: 'TS012',
    name: 'Path Traversal Risk',
    pattern: /(?:readFile|writeFile|readFileSync|writeFileSync|createReadStream|createWriteStream)\s*\(\s*(?:[^'"]+\+|`.+\$\{)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-22',
    owasp: 'A01:2021',
    description: 'File operation with potentially unvalidated path',
    recommendation: 'Validate and sanitize file paths; use path.resolve() and check against allowed directories',
  },

  // Insecure Deserialization
  {
    id: 'TS013',
    name: 'Insecure Deserialization',
    pattern: /JSON\.parse\s*\(\s*(?:req\.|request\.|body|params|query)/gi,
    severity: 'medium',
    category: 'injection',
    cwe: 'CWE-502',
    owasp: 'A08:2021',
    description: 'Deserialization of untrusted data',
    recommendation: 'Validate and sanitize input before parsing',
  },

  // Insecure Cookie Settings
  {
    id: 'TS014',
    name: 'Cookie Without Secure Flag',
    pattern: /cookie\s*\([^)]+(?:secure\s*:\s*false|(?!secure))/gi,
    severity: 'medium',
    category: 'configuration',
    cwe: 'CWE-614',
    owasp: 'A05:2021',
    description: 'Cookie set without secure flag',
    recommendation: 'Set secure: true and httpOnly: true for sensitive cookies',
  },

  // Hardcoded Credentials
  {
    id: 'TS015',
    name: 'Hardcoded Password',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded password in source code',
    recommendation: 'Use environment variables or a secrets manager',
  },
  {
    id: 'TS016',
    name: 'Hardcoded API Key',
    pattern: /(?:api[-_]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded API key in source code',
    recommendation: 'Use environment variables or a secrets manager',
  },

  // CORS Misconfiguration
  {
    id: 'TS017',
    name: 'Overly Permissive CORS',
    pattern: /(?:Access-Control-Allow-Origin|cors)\s*[:=]\s*['"]\*['"]/gi,
    severity: 'medium',
    category: 'configuration',
    cwe: 'CWE-942',
    owasp: 'A05:2021',
    description: 'CORS allows all origins',
    recommendation: 'Restrict allowed origins to specific domains',
  },

  // Prototype Pollution
  {
    id: 'TS018',
    name: 'Potential Prototype Pollution',
    pattern: /\[(?:__proto__|constructor|prototype)\]/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-1321',
    owasp: 'A03:2021',
    description: 'Property access that could enable prototype pollution',
    recommendation: 'Use Object.create(null) or Map for key-value storage',
  },

  // Debug/Development Code
  {
    id: 'TS019',
    name: 'Debug Code in Production',
    pattern: /(?:debugger|console\.log|console\.debug)\s*[;(]/gi,
    severity: 'low',
    category: 'configuration',
    cwe: 'CWE-489',
    owasp: 'A05:2021',
    description: 'Debug statement that may leak information',
    recommendation: 'Remove debug statements before production',
  },
];

// ============================================================================
// Scanner Functions
// ============================================================================

export function scanTypeScript(
  source: string,
  filePath: string = 'source.ts',
  options: TypeScriptScanOptions = DEFAULT_OPTIONS
): TypeScriptScanResult {
  const findings: Finding[] = [];
  const lines = source.split('\n');
  let patternsMatched = 0;

  for (const pattern of TYPESCRIPT_PATTERNS) {
    // Skip disabled checks
    if (!shouldCheckPattern(pattern, options)) {
      continue;
    }

    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

    while ((match = regex.exec(source)) !== null) {
      // Calculate location
      const beforeMatch = source.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const line = lines[lineNumber - 1] || '';
      const column = match.index - beforeMatch.lastIndexOf('\n');

      // Skip if in comment
      if (isInComment(line, column, match[0])) {
        continue;
      }

      // Skip false positives for certain patterns
      if (isFalsePositive(pattern, match[0], line)) {
        continue;
      }

      patternsMatched++;

      findings.push({
        id: pattern.id,
        title: pattern.name,
        severity: pattern.severity,
        category: pattern.category as any,
        location: {
          file: filePath,
          startLine: lineNumber,
          startColumn: column,
          endLine: lineNumber,
          endColumn: column + match[0].length,
        },
        description: `${pattern.description}: "${truncate(match[0], 60)}"`,
        recommendation: pattern.recommendation,
        cwe: pattern.cwe,
        owasp: pattern.owasp,
        fix: pattern.fix,
        context: {
          matchedText: truncate(match[0], 100),
          line: truncate(line.trim(), 120),
        },
      });
    }
  }

  return {
    findings,
    linesScanned: lines.length,
    patternsMatched,
  };
}

function shouldCheckPattern(
  pattern: VulnerabilityPattern,
  options: TypeScriptScanOptions
): boolean {
  // Special handling for specific patterns
  if (pattern.id.startsWith('TS001') || pattern.id.startsWith('TS002')) {
    return options.checkSqlInjection !== false;
  }
  if (pattern.id.startsWith('TS003') || pattern.id === 'TS004' || pattern.id === 'TS005') {
    return options.checkCommandInjection !== false;
  }
  if (pattern.id === 'TS006') {
    return options.checkInsecureRandom !== false;
  }
  if (pattern.id === 'TS007' || pattern.id === 'TS008') {
    return options.checkWeakCrypto !== false;
  }
  if (pattern.id.startsWith('TS009') || pattern.id === 'TS010' || pattern.id === 'TS011') {
    return options.checkXss !== false;
  }
  if (pattern.id === 'TS012') {
    return options.checkPathTraversal !== false;
  }
  if (pattern.id === 'TS015' || pattern.id === 'TS016') {
    return options.checkHardcodedSecrets !== false;
  }

  return true;
}

function isInComment(line: string, column: number, _match: string): boolean {
  const beforeMatch = line.substring(0, column);
  
  // Single-line comment
  if (beforeMatch.includes('//')) {
    return true;
  }
  
  // Multi-line comment (simplified check)
  if (beforeMatch.includes('/*') && !beforeMatch.includes('*/')) {
    return true;
  }

  return false;
}

function isFalsePositive(
  pattern: VulnerabilityPattern,
  match: string,
  line: string
): boolean {
  const lowerLine = line.toLowerCase();
  const lowerMatch = match.toLowerCase();

  // Skip test files patterns
  if (lowerLine.includes('test') || lowerLine.includes('mock') || lowerLine.includes('fixture')) {
    return true;
  }

  // Skip environment variable references for secrets
  if (pattern.category === 'secrets') {
    if (lowerLine.includes('process.env') || lowerLine.includes('env[')) {
      return true;
    }
    if (lowerMatch.includes('example') || lowerMatch.includes('placeholder') || lowerMatch.includes('xxx')) {
      return true;
    }
  }

  // Skip parameterized queries
  if (pattern.id.startsWith('TS001') || pattern.id.startsWith('TS002')) {
    if (lowerLine.includes('$1') || lowerLine.includes('?') && lowerLine.includes('[')) {
      return true;
    }
  }

  return false;
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Exported Helpers
// ============================================================================

export function getTypeScriptPatternCount(): number {
  return TYPESCRIPT_PATTERNS.length;
}

export function getTypeScriptPatternsByCategory(category: string): VulnerabilityPattern[] {
  return TYPESCRIPT_PATTERNS.filter((p) => p.category === category);
}
