// ============================================================================
// Go Implementation Scanner
// Scans Go source code for security vulnerabilities
// ============================================================================

import { Finding } from '../severity';

// ============================================================================
// Scanner Interface
// ============================================================================

export interface GoScanResult {
  findings: Finding[];
  linesScanned: number;
  patternsMatched: number;
}

export interface GoScanOptions {
  checkSqlInjection?: boolean;
  checkCommandInjection?: boolean;
  checkSsrf?: boolean;
  checkPathTraversal?: boolean;
  checkHardcodedSecrets?: boolean;
  checkUnsafeDeserialize?: boolean;
  checkTlsVerification?: boolean;
  checkWeakCrypto?: boolean;
}

const DEFAULT_OPTIONS: GoScanOptions = {
  checkSqlInjection: true,
  checkCommandInjection: true,
  checkSsrf: true,
  checkPathTraversal: true,
  checkHardcodedSecrets: true,
  checkUnsafeDeserialize: true,
  checkTlsVerification: true,
  checkWeakCrypto: true,
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

const GO_PATTERNS: VulnerabilityPattern[] = [
  // SQL Injection
  {
    id: 'GO001',
    name: 'SQL Injection via String Concatenation',
    pattern: /(?:db|tx)\.(?:Query|QueryRow|Exec|QueryContext|ExecContext)\s*\([^)]*["'`](?:SELECT|INSERT|UPDATE|DELETE|DROP)\b[^"'`]*["'`]\s*\+/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL query built using string concatenation',
    recommendation: 'Use parameterized queries with placeholder arguments',
    fix: `// Use parameterized query:\nrows, err := db.Query("SELECT * FROM users WHERE id = $1", userId)`,
  },
  {
    id: 'GO002',
    name: 'SQL Injection via fmt.Sprintf',
    pattern: /(?:db|tx)\.(?:Query|QueryRow|Exec|QueryContext|ExecContext)\s*\(\s*fmt\.Sprintf\s*\(\s*["'`](?:SELECT|INSERT|UPDATE|DELETE)\b/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL query built using fmt.Sprintf interpolation',
    recommendation: 'Use parameterized queries instead of fmt.Sprintf for SQL',
    fix: `// Use parameterized query:\nrows, err := db.Query("SELECT * FROM users WHERE name = $1", name)`,
  },
  {
    id: 'GO003',
    name: 'SQL Injection via String Addition',
    pattern: /["'`](?:SELECT|INSERT|UPDATE|DELETE|DROP)\b[^"'`]*["'`]\s*\+\s*\w+/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL string built by concatenating variables',
    recommendation: 'Never concatenate user input into SQL queries',
  },

  // Command Injection
  {
    id: 'GO004',
    name: 'Command Injection via exec.Command with Shell',
    pattern: /exec\.Command\s*\(\s*["'](?:sh|bash|cmd|powershell)["']\s*,\s*["']-c["']\s*,/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    description: 'Shell command execution that may include user input',
    recommendation: 'Use exec.Command with explicit arguments instead of shell invocation',
    fix: `// Use direct command with args:\ncmd := exec.Command("ls", "-la", dirPath)`,
  },
  {
    id: 'GO005',
    name: 'Command Injection via fmt.Sprintf in exec',
    pattern: /exec\.Command\s*\([^)]*fmt\.Sprintf/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    description: 'Command arguments built with fmt.Sprintf may include user input',
    recommendation: 'Pass arguments as separate exec.Command parameters',
  },
  {
    id: 'GO006',
    name: 'Command Injection via os.exec with Concatenation',
    pattern: /exec\.Command\s*\(\s*[^"'\s][^,)]*\+/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    description: 'Command name or args built via string concatenation',
    recommendation: 'Use static command names and pass user input as separate args',
  },

  // SSRF
  {
    id: 'GO007',
    name: 'Potential SSRF via http.Get',
    pattern: /http\.Get\s*\(\s*(?:[^"'][^)]*|[^)]*\+)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    description: 'HTTP GET request with potentially user-controlled URL',
    recommendation: 'Validate and allowlist URLs before making requests',
  },
  {
    id: 'GO008',
    name: 'Potential SSRF via http.NewRequest',
    pattern: /http\.NewRequest\s*\(\s*["'][^"']*["']\s*,\s*(?:[^"'][^,]*|[^,]*\+)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    description: 'HTTP request with potentially user-controlled URL',
    recommendation: 'Validate URLs against an allowlist and block internal addresses',
  },
  {
    id: 'GO009',
    name: 'Potential SSRF via http.Post',
    pattern: /http\.Post\s*\(\s*(?:[^"'][^,]*|[^,]*\+)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    description: 'HTTP POST request with potentially user-controlled URL',
    recommendation: 'Validate and allowlist URLs before making requests',
  },

  // Path Traversal
  {
    id: 'GO010',
    name: 'Path Traversal via os.Open',
    pattern: /os\.(?:Open|OpenFile|ReadFile|Create)\s*\(\s*(?:filepath\.Join\s*\([^)]*\w+[^)]*\)|[^"'][^)]*\+)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-22',
    owasp: 'A01:2021',
    description: 'File operation with potentially user-controlled path',
    recommendation: 'Use filepath.Clean() and validate paths against a base directory',
    fix: `// Clean and validate path:\ncleanPath := filepath.Clean(userInput)\nif !strings.HasPrefix(filepath.Join(baseDir, cleanPath), baseDir) {\n  return errors.New("path traversal detected")\n}`,
  },
  {
    id: 'GO011',
    name: 'Path Traversal via ioutil.ReadFile',
    pattern: /ioutil\.(?:ReadFile|WriteFile)\s*\(\s*(?:[^"'][^,]*\+|[^"'][^,]*\w)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-22',
    owasp: 'A01:2021',
    description: 'File read/write with potentially unvalidated path',
    recommendation: 'Validate file paths and restrict to allowed directories',
  },

  // Hardcoded Secrets
  {
    id: 'GO012',
    name: 'Hardcoded API Key',
    pattern: /(?:apiKey|api_key|ApiKey|API_KEY)\s*(?::=|=)\s*["'][A-Za-z0-9_\-]{20,}["']/g,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded API key in source code',
    recommendation: 'Use environment variables or a secrets manager',
    fix: `apiKey := os.Getenv("API_KEY")`,
  },
  {
    id: 'GO013',
    name: 'Hardcoded Password',
    pattern: /(?:password|passwd|pwd|secret)\s*(?::=|=)\s*["'][^"']{4,}["']/gi,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded password or secret in source code',
    recommendation: 'Use environment variables or a secrets manager',
  },
  {
    id: 'GO014',
    name: 'Hardcoded Token Pattern',
    pattern: /["'](?:sk_live_|sk_test_|ghp_|gho_|github_pat_|xoxb-|xoxp-|AKIA)[A-Za-z0-9_\-]+["']/g,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded service token detected',
    recommendation: 'Remove the token and rotate it immediately; use environment variables',
  },

  // Unsafe Deserialization
  {
    id: 'GO015',
    name: 'Unsafe JSON Unmarshal from User Input',
    pattern: /json\.(?:Unmarshal|NewDecoder)\s*\(\s*(?:r\.Body|req\.Body|body|request\.Body)/gi,
    severity: 'medium',
    category: 'injection',
    cwe: 'CWE-502',
    owasp: 'A08:2021',
    description: 'JSON deserialization of request body without validation',
    recommendation: 'Validate and limit input size before unmarshaling; use struct tags for field constraints',
  },
  {
    id: 'GO016',
    name: 'Unsafe Gob/XML Deserialization',
    pattern: /(?:gob|xml)\.(?:NewDecoder|Unmarshal)\s*\(\s*(?:r\.Body|req\.Body|body)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-502',
    owasp: 'A08:2021',
    description: 'Deserialization of untrusted data via gob or XML',
    recommendation: 'Prefer JSON over gob for untrusted input; validate XML with schema',
  },

  // Missing TLS Verification
  {
    id: 'GO017',
    name: 'TLS Certificate Verification Disabled',
    pattern: /InsecureSkipVerify\s*:\s*true/g,
    severity: 'high',
    category: 'cryptography',
    cwe: 'CWE-295',
    owasp: 'A02:2021',
    description: 'TLS certificate verification is disabled',
    recommendation: 'Always verify TLS certificates in production',
    fix: `// Use proper TLS config:\ntlsConfig := &tls.Config{InsecureSkipVerify: false}`,
  },

  // Weak Cryptography
  {
    id: 'GO018',
    name: 'Weak Hash Algorithm (MD5)',
    pattern: /md5\.(?:New|Sum)\s*\(/g,
    severity: 'high',
    category: 'cryptography',
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    description: 'MD5 is cryptographically broken and should not be used for security',
    recommendation: 'Use SHA-256 or stronger: sha256.Sum256()',
  },
  {
    id: 'GO019',
    name: 'Weak Hash Algorithm (SHA-1)',
    pattern: /sha1\.(?:New|Sum)\s*\(/g,
    severity: 'medium',
    category: 'cryptography',
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    description: 'SHA-1 is deprecated for security purposes',
    recommendation: 'Use SHA-256 or stronger: sha256.Sum256()',
  },

  // Insecure Randomness
  {
    id: 'GO020',
    name: 'Insecure Random Number Generation',
    pattern: /math\/rand/g,
    severity: 'medium',
    category: 'cryptography',
    cwe: 'CWE-330',
    owasp: 'A02:2021',
    description: 'math/rand is not cryptographically secure',
    recommendation: 'Use crypto/rand for security-sensitive random values',
    fix: `// Use crypto/rand:\nimport "crypto/rand"\nbuf := make([]byte, 32)\n_, err := rand.Read(buf)`,
  },

  // Race Conditions
  {
    id: 'GO021',
    name: 'Potential Race Condition on Shared State',
    pattern: /go\s+func\s*\(\s*\)\s*\{[^}]*\b(?:map|slice|append)\b/gi,
    severity: 'medium',
    category: 'data-exposure',
    cwe: 'CWE-362',
    owasp: 'A04:2021',
    description: 'Goroutine accessing shared mutable state without synchronization',
    recommendation: 'Use sync.Mutex, sync.RWMutex, or channels to protect shared state',
  },

  // Binding to All Interfaces
  {
    id: 'GO022',
    name: 'Binding to All Interfaces',
    pattern: /(?:Listen|ListenAndServe)\s*\(\s*["']:?\d+["']/gi,
    severity: 'medium',
    category: 'configuration',
    cwe: 'CWE-284',
    owasp: 'A05:2021',
    description: 'Server binding to all network interfaces (missing host)',
    recommendation: 'Bind to a specific interface or localhost in development',
  },
];

// ============================================================================
// Scanner Functions
// ============================================================================

export function scanGo(
  source: string,
  filePath: string = 'source.go',
  options: GoScanOptions = DEFAULT_OPTIONS
): GoScanResult {
  const findings: Finding[] = [];
  const lines = source.split('\n');
  let patternsMatched = 0;

  for (const pattern of GO_PATTERNS) {
    if (!shouldCheckPattern(pattern, options)) {
      continue;
    }

    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

    while ((match = regex.exec(source)) !== null) {
      const beforeMatch = source.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const line = lines[lineNumber - 1] || '';
      const column = match.index - beforeMatch.lastIndexOf('\n');

      if (isInComment(line, column)) {
        continue;
      }

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
  options: GoScanOptions
): boolean {
  if (pattern.id === 'GO001' || pattern.id === 'GO002' || pattern.id === 'GO003') {
    return options.checkSqlInjection !== false;
  }
  if (pattern.id === 'GO004' || pattern.id === 'GO005' || pattern.id === 'GO006') {
    return options.checkCommandInjection !== false;
  }
  if (pattern.id === 'GO007' || pattern.id === 'GO008' || pattern.id === 'GO009') {
    return options.checkSsrf !== false;
  }
  if (pattern.id === 'GO010' || pattern.id === 'GO011') {
    return options.checkPathTraversal !== false;
  }
  if (pattern.id === 'GO012' || pattern.id === 'GO013' || pattern.id === 'GO014') {
    return options.checkHardcodedSecrets !== false;
  }
  if (pattern.id === 'GO015' || pattern.id === 'GO016') {
    return options.checkUnsafeDeserialize !== false;
  }
  if (pattern.id === 'GO017') {
    return options.checkTlsVerification !== false;
  }
  if (pattern.id === 'GO018' || pattern.id === 'GO019' || pattern.id === 'GO020') {
    return options.checkWeakCrypto !== false;
  }

  return true;
}

function isInComment(line: string, column: number): boolean {
  const beforeColumn = line.substring(0, column);
  return beforeColumn.includes('//');
}

function isFalsePositive(
  pattern: VulnerabilityPattern,
  match: string,
  line: string
): boolean {
  const lowerLine = line.toLowerCase();
  const lowerMatch = match.toLowerCase();

  if (lowerLine.includes('_test.go') || lowerLine.includes('test') || lowerLine.includes('mock')) {
    return true;
  }

  if (pattern.category === 'secrets') {
    if (lowerLine.includes('os.getenv') || lowerLine.includes('os.lookupenv')) {
      return true;
    }
    if (lowerMatch.includes('example') || lowerMatch.includes('placeholder') || lowerMatch.includes('xxx') || lowerMatch.includes('changeme')) {
      return true;
    }
  }

  if (pattern.id === 'GO001' || pattern.id === 'GO002') {
    if (lowerLine.includes('$1') || lowerLine.includes('$2') || lowerLine.includes('?')) {
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

export function getGoPatternCount(): number {
  return GO_PATTERNS.length;
}

export function getGoPatternsByCategory(category: string): VulnerabilityPattern[] {
  return GO_PATTERNS.filter((p) => p.category === category);
}
