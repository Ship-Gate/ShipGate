// ============================================================================
// Python Implementation Scanner
// Scans Python source code for security vulnerabilities
// ============================================================================

import { Finding, SourceLocation } from '../severity';

// ============================================================================
// Scanner Interface
// ============================================================================

export interface PythonScanResult {
  findings: Finding[];
  linesScanned: number;
  patternsMatched: number;
}

export interface PythonScanOptions {
  checkSqlInjection?: boolean;
  checkCommandInjection?: boolean;
  checkInsecureRandom?: boolean;
  checkHardcodedSecrets?: boolean;
  checkWeakCrypto?: boolean;
  checkPickle?: boolean;
  checkYaml?: boolean;
  checkXxe?: boolean;
  checkSsrf?: boolean;
}

const DEFAULT_OPTIONS: PythonScanOptions = {
  checkSqlInjection: true,
  checkCommandInjection: true,
  checkInsecureRandom: true,
  checkHardcodedSecrets: true,
  checkWeakCrypto: true,
  checkPickle: true,
  checkYaml: true,
  checkXxe: true,
  checkSsrf: true,
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

const PYTHON_PATTERNS: VulnerabilityPattern[] = [
  // SQL Injection
  {
    id: 'PY001',
    name: 'SQL Injection via String Formatting',
    pattern: /(?:execute|executemany|raw)\s*\(\s*f?["'](?:SELECT|INSERT|UPDATE|DELETE|DROP).+(?:\{|\%s)/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL query built using string formatting',
    recommendation: 'Use parameterized queries',
    fix: `# Use parameterized query:\ncursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))`,
  },
  {
    id: 'PY002',
    name: 'SQL Injection via Format Method',
    pattern: /(?:execute|executemany)\s*\(\s*["'](?:SELECT|INSERT|UPDATE|DELETE).+["']\.format\s*\(/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL query built using .format()',
    recommendation: 'Use parameterized queries instead of string formatting',
  },
  {
    id: 'PY003',
    name: 'SQL Injection via Concatenation',
    pattern: /(?:execute|executemany)\s*\(\s*["'](?:SELECT|INSERT|UPDATE|DELETE).+["']\s*\+/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL query built using string concatenation',
    recommendation: 'Use parameterized queries',
  },

  // Command Injection
  {
    id: 'PY004',
    name: 'Command Injection via os.system',
    pattern: /os\.system\s*\(\s*(?:f["']|["'].+\+|["'].+\.format|["'].+%)/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    description: 'os.system() with user-controlled input',
    recommendation: 'Use subprocess with shell=False and list arguments',
    fix: `# Use subprocess safely:\nimport subprocess\nsubprocess.run(['command', arg1, arg2], shell=False)`,
  },
  {
    id: 'PY005',
    name: 'Command Injection via subprocess shell',
    pattern: /subprocess\.(?:call|run|Popen)\s*\([^)]*shell\s*=\s*True/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    description: 'subprocess with shell=True is dangerous',
    recommendation: 'Use shell=False with list arguments',
  },
  {
    id: 'PY006',
    name: 'Dangerous eval Usage',
    pattern: /\beval\s*\(/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-95',
    owasp: 'A03:2021',
    description: 'eval() can execute arbitrary code',
    recommendation: 'Use ast.literal_eval() for safe evaluation of literals',
  },
  {
    id: 'PY007',
    name: 'Dangerous exec Usage',
    pattern: /\bexec\s*\(/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-95',
    owasp: 'A03:2021',
    description: 'exec() can execute arbitrary code',
    recommendation: 'Avoid exec(); use structured alternatives',
  },

  // Insecure Randomness
  {
    id: 'PY008',
    name: 'Insecure Random Number Generation',
    pattern: /random\.(?:random|randint|choice|randrange|shuffle)\s*\(/g,
    severity: 'medium',
    category: 'cryptography',
    cwe: 'CWE-330',
    owasp: 'A02:2021',
    description: 'random module is not cryptographically secure',
    recommendation: 'Use secrets module for security-sensitive operations',
    fix: `import secrets\ntoken = secrets.token_hex(32)\nrandom_int = secrets.randbelow(100)`,
  },

  // Weak Cryptography
  {
    id: 'PY009',
    name: 'Weak Hash Algorithm (MD5)',
    pattern: /hashlib\.md5\s*\(/gi,
    severity: 'high',
    category: 'cryptography',
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    description: 'MD5 is cryptographically broken',
    recommendation: 'Use SHA-256 or stronger: hashlib.sha256()',
  },
  {
    id: 'PY010',
    name: 'Weak Hash Algorithm (SHA-1)',
    pattern: /hashlib\.sha1\s*\(/gi,
    severity: 'medium',
    category: 'cryptography',
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    description: 'SHA-1 is deprecated for security purposes',
    recommendation: 'Use SHA-256 or stronger: hashlib.sha256()',
  },

  // Insecure Deserialization
  {
    id: 'PY011',
    name: 'Insecure Pickle Deserialization',
    pattern: /pickle\.(?:load|loads)\s*\(/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-502',
    owasp: 'A08:2021',
    description: 'Pickle can execute arbitrary code during deserialization',
    recommendation: 'Use JSON or other safe serialization formats',
    fix: `# Use JSON instead:\nimport json\ndata = json.loads(serialized_data)`,
  },
  {
    id: 'PY012',
    name: 'Insecure YAML Loading',
    pattern: /yaml\.(?:load|unsafe_load)\s*\([^)]*(?!Loader)/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-502',
    owasp: 'A08:2021',
    description: 'yaml.load() without safe Loader can execute code',
    recommendation: 'Use yaml.safe_load() instead',
    fix: `# Use safe loader:\nimport yaml\ndata = yaml.safe_load(yaml_string)`,
  },

  // XML External Entity (XXE)
  {
    id: 'PY013',
    name: 'XML External Entity (XXE) Vulnerability',
    pattern: /(?:etree\.parse|minidom\.parse|xml\.sax\.parse)\s*\(/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-611',
    owasp: 'A05:2021',
    description: 'XML parser may be vulnerable to XXE attacks',
    recommendation: 'Disable external entities in XML parser configuration',
    fix: `# Use defusedxml:\nimport defusedxml.ElementTree as ET\ntree = ET.parse(xml_file)`,
  },

  // SSRF
  {
    id: 'PY014',
    name: 'Potential SSRF Vulnerability',
    pattern: /requests\.(?:get|post|put|delete|patch)\s*\(\s*(?:f["']|[^"']+\+|.+\.format)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    description: 'HTTP request with potentially user-controlled URL',
    recommendation: 'Validate and whitelist allowed URLs',
  },
  {
    id: 'PY015',
    name: 'Potential SSRF via urllib',
    pattern: /urllib\.request\.urlopen\s*\(\s*(?:f["']|[^"']+\+|.+\.format)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    description: 'URL request with potentially user-controlled URL',
    recommendation: 'Validate and whitelist allowed URLs',
  },

  // Path Traversal
  {
    id: 'PY016',
    name: 'Path Traversal Risk',
    pattern: /(?:open|os\.path\.join)\s*\(\s*(?:f["']|.+\+|.+\.format)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-22',
    owasp: 'A01:2021',
    description: 'File operation with potentially user-controlled path',
    recommendation: 'Validate and sanitize file paths; use os.path.realpath() and check against allowed directories',
  },

  // Hardcoded Secrets
  {
    id: 'PY017',
    name: 'Hardcoded Password',
    pattern: /(?:password|passwd|pwd)\s*=\s*["'][^"']+["']/gi,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded password in source code',
    recommendation: 'Use environment variables or a secrets manager',
    fix: `import os\npassword = os.environ.get('DB_PASSWORD')`,
  },
  {
    id: 'PY018',
    name: 'Hardcoded API Key',
    pattern: /(?:api[-_]?key|apikey|secret[-_]?key)\s*=\s*["'][A-Za-z0-9_\-]{20,}["']/gi,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded API key in source code',
    recommendation: 'Use environment variables or a secrets manager',
  },
  {
    id: 'PY019',
    name: 'Hardcoded AWS Credentials',
    pattern: /(?:aws_access_key_id|aws_secret_access_key)\s*=\s*["'][A-Za-z0-9/+=]+["']/gi,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded AWS credentials in source code',
    recommendation: 'Use IAM roles or environment variables',
  },

  // Debug/Development Code
  {
    id: 'PY020',
    name: 'Debug Mode Enabled',
    pattern: /(?:DEBUG|debug)\s*=\s*True/gi,
    severity: 'medium',
    category: 'configuration',
    cwe: 'CWE-489',
    owasp: 'A05:2021',
    description: 'Debug mode may be enabled in production',
    recommendation: 'Disable debug mode in production via environment variable',
  },
  {
    id: 'PY021',
    name: 'Flask Debug Mode',
    pattern: /app\.run\s*\([^)]*debug\s*=\s*True/gi,
    severity: 'high',
    category: 'configuration',
    cwe: 'CWE-489',
    owasp: 'A05:2021',
    description: 'Flask running with debug mode enabled',
    recommendation: 'Never run Flask debug mode in production',
  },

  // Assert in Production
  {
    id: 'PY022',
    name: 'Assert for Security Check',
    pattern: /assert\s+(?:user|admin|auth|permission|role)/gi,
    severity: 'medium',
    category: 'authorization',
    cwe: 'CWE-617',
    owasp: 'A01:2021',
    description: 'Assert statements are removed when Python is optimized',
    recommendation: 'Use proper if statements for security checks',
  },

  // Binding to All Interfaces
  {
    id: 'PY023',
    name: 'Binding to All Interfaces',
    pattern: /(?:host|bind)\s*=\s*["']0\.0\.0\.0["']/gi,
    severity: 'medium',
    category: 'configuration',
    cwe: 'CWE-284',
    owasp: 'A05:2021',
    description: 'Server binding to all network interfaces',
    recommendation: 'Bind to specific interface or localhost in development',
  },

  // Insecure SSL
  {
    id: 'PY024',
    name: 'SSL Verification Disabled',
    pattern: /verify\s*=\s*False/gi,
    severity: 'high',
    category: 'cryptography',
    cwe: 'CWE-295',
    owasp: 'A02:2021',
    description: 'SSL certificate verification is disabled',
    recommendation: 'Always verify SSL certificates in production',
  },
];

// ============================================================================
// Scanner Functions
// ============================================================================

export function scanPython(
  source: string,
  filePath: string = 'source.py',
  options: PythonScanOptions = DEFAULT_OPTIONS
): PythonScanResult {
  const findings: Finding[] = [];
  const lines = source.split('\n');
  let patternsMatched = 0;

  for (const pattern of PYTHON_PATTERNS) {
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
      if (isInComment(line, column)) {
        continue;
      }

      // Skip false positives
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
  options: PythonScanOptions
): boolean {
  if (pattern.id.startsWith('PY001') || pattern.id.startsWith('PY002') || pattern.id.startsWith('PY003')) {
    return options.checkSqlInjection !== false;
  }
  if (pattern.id.startsWith('PY004') || pattern.id.startsWith('PY005') || pattern.id === 'PY006' || pattern.id === 'PY007') {
    return options.checkCommandInjection !== false;
  }
  if (pattern.id === 'PY008') {
    return options.checkInsecureRandom !== false;
  }
  if (pattern.id === 'PY009' || pattern.id === 'PY010') {
    return options.checkWeakCrypto !== false;
  }
  if (pattern.id === 'PY011') {
    return options.checkPickle !== false;
  }
  if (pattern.id === 'PY012') {
    return options.checkYaml !== false;
  }
  if (pattern.id === 'PY013') {
    return options.checkXxe !== false;
  }
  if (pattern.id === 'PY014' || pattern.id === 'PY015') {
    return options.checkSsrf !== false;
  }
  if (pattern.id.startsWith('PY017') || pattern.id.startsWith('PY018') || pattern.id === 'PY019') {
    return options.checkHardcodedSecrets !== false;
  }

  return true;
}

function isInComment(line: string, column: number): boolean {
  const beforeColumn = line.substring(0, column);
  return beforeColumn.includes('#');
}

function isFalsePositive(
  pattern: VulnerabilityPattern,
  match: string,
  line: string
): boolean {
  const lowerLine = line.toLowerCase();
  const lowerMatch = match.toLowerCase();

  // Skip test files
  if (lowerLine.includes('test') || lowerLine.includes('mock') || lowerLine.includes('fixture')) {
    return true;
  }

  // Skip environment variable references for secrets
  if (pattern.category === 'secrets') {
    if (lowerLine.includes('os.environ') || lowerLine.includes('os.getenv')) {
      return true;
    }
    if (lowerMatch.includes('example') || lowerMatch.includes('placeholder') || lowerMatch.includes('xxx')) {
      return true;
    }
  }

  // Skip safe yaml loading
  if (pattern.id === 'PY012') {
    if (lowerLine.includes('safe_load') || lowerLine.includes('safeloader')) {
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

export function getPythonPatternCount(): number {
  return PYTHON_PATTERNS.length;
}

export function getPythonPatternsByCategory(category: string): VulnerabilityPattern[] {
  return PYTHON_PATTERNS.filter((p) => p.category === category);
}
