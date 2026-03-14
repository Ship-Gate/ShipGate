// ============================================================================
// Java Implementation Scanner
// Scans Java source code for security vulnerabilities
// ============================================================================

import { Finding } from '../severity';

// ============================================================================
// Scanner Interface
// ============================================================================

export interface JavaScanResult {
  findings: Finding[];
  linesScanned: number;
  patternsMatched: number;
}

export interface JavaScanOptions {
  checkSqlInjection?: boolean;
  checkCommandInjection?: boolean;
  checkXxe?: boolean;
  checkSsrf?: boolean;
  checkHardcodedSecrets?: boolean;
  checkInsecureDeserialize?: boolean;
  checkPathTraversal?: boolean;
  checkWeakCrypto?: boolean;
  checkXss?: boolean;
}

const DEFAULT_OPTIONS: JavaScanOptions = {
  checkSqlInjection: true,
  checkCommandInjection: true,
  checkXxe: true,
  checkSsrf: true,
  checkHardcodedSecrets: true,
  checkInsecureDeserialize: true,
  checkPathTraversal: true,
  checkWeakCrypto: true,
  checkXss: true,
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

const JAVA_PATTERNS: VulnerabilityPattern[] = [
  // SQL Injection
  {
    id: 'JV001',
    name: 'SQL Injection via Statement.executeQuery',
    pattern: /(?:executeQuery|executeUpdate|execute)\s*\(\s*["'](?:SELECT|INSERT|UPDATE|DELETE|DROP)\b[^"']*["']\s*\+/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL query built using string concatenation in Statement',
    recommendation: 'Use PreparedStatement with parameterized queries',
    fix: `// Use PreparedStatement:\nPreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE id = ?");\nps.setString(1, userId);`,
  },
  {
    id: 'JV002',
    name: 'SQL Injection via String Concatenation',
    pattern: /["'](?:SELECT|INSERT|UPDATE|DELETE|DROP)\b[^"']*["']\s*\+\s*(?!["'])/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL string built by concatenating variables',
    recommendation: 'Use PreparedStatement or an ORM instead of string concatenation',
  },
  {
    id: 'JV003',
    name: 'SQL Injection via String.format in Query',
    pattern: /(?:executeQuery|executeUpdate|execute)\s*\(\s*String\.format\s*\(\s*["'](?:SELECT|INSERT|UPDATE|DELETE)\b/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    description: 'SQL query built using String.format interpolation',
    recommendation: 'Use PreparedStatement with parameter binding',
  },

  // Command Injection
  {
    id: 'JV004',
    name: 'Command Injection via Runtime.exec',
    pattern: /Runtime\.getRuntime\s*\(\s*\)\.exec\s*\(\s*(?:[^"'][^)]*|[^)]*\+)/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    description: 'Runtime.exec() with potentially user-controlled input',
    recommendation: 'Use ProcessBuilder with explicit argument list',
    fix: `// Use ProcessBuilder:\nProcessBuilder pb = new ProcessBuilder("command", arg1, arg2);\nProcess p = pb.start();`,
  },
  {
    id: 'JV005',
    name: 'Command Injection via ProcessBuilder with Shell',
    pattern: /new\s+ProcessBuilder\s*\(\s*(?:Arrays\.asList\s*\()?["'](?:sh|bash|cmd|cmd\.exe|powershell)["']\s*,\s*["']-c["']/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    description: 'ProcessBuilder invokes shell which may pass user input unsafely',
    recommendation: 'Avoid shell invocation; use ProcessBuilder with explicit arguments',
  },
  {
    id: 'JV006',
    name: 'Command Injection via Runtime.exec with Concatenation',
    pattern: /Runtime\.getRuntime\s*\(\s*\)\.exec\s*\(\s*["'][^"']+["']\s*\+/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    description: 'Shell command string built with concatenation',
    recommendation: 'Use ProcessBuilder with array arguments',
  },

  // XXE (XML External Entity)
  {
    id: 'JV007',
    name: 'XXE via DocumentBuilderFactory',
    pattern: /DocumentBuilderFactory\.newInstance\s*\(\s*\)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-611',
    owasp: 'A05:2021',
    description: 'DocumentBuilderFactory without external entity restrictions',
    recommendation: 'Disable external entities and DTDs in the factory configuration',
    fix: `// Secure DocumentBuilderFactory:\nDocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();\ndbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);\ndbf.setFeature("http://xml.org/sax/features/external-general-entities", false);`,
  },
  {
    id: 'JV008',
    name: 'XXE via SAXParserFactory',
    pattern: /SAXParserFactory\.newInstance\s*\(\s*\)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-611',
    owasp: 'A05:2021',
    description: 'SAXParserFactory without external entity restrictions',
    recommendation: 'Disable external entities: factory.setFeature("http://xml.org/sax/features/external-general-entities", false)',
  },
  {
    id: 'JV009',
    name: 'XXE via XMLInputFactory',
    pattern: /XMLInputFactory\.newInstance\s*\(\s*\)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-611',
    owasp: 'A05:2021',
    description: 'XMLInputFactory without external entity restrictions',
    recommendation: 'Set XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES to false',
  },

  // SSRF
  {
    id: 'JV010',
    name: 'Potential SSRF via URL.openConnection',
    pattern: /new\s+URL\s*\(\s*(?:[^"'][^)]*|[^)]*\+)\s*\)\.(?:openConnection|openStream)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    description: 'URL connection with potentially user-controlled URL',
    recommendation: 'Validate and allowlist URLs before connecting',
  },
  {
    id: 'JV011',
    name: 'Potential SSRF via HttpClient',
    pattern: /HttpClient\s*\.(?:newHttpClient|send)\s*\([^)]*(?:[^"'][^)]*\+|HttpRequest\.newBuilder\s*\(\s*\)\s*\.uri\s*\(\s*URI\.create\s*\(\s*[^"'])/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    description: 'HttpClient request with potentially user-controlled URL',
    recommendation: 'Validate and allowlist URLs; block internal IP ranges',
  },
  {
    id: 'JV012',
    name: 'Potential SSRF via RestTemplate',
    pattern: /restTemplate\.(?:getForObject|getForEntity|postForObject|exchange)\s*\(\s*(?:[^"'][^,]*|[^,]*\+)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    description: 'Spring RestTemplate request with potentially user-controlled URL',
    recommendation: 'Validate URLs before making requests',
  },

  // Hardcoded Secrets
  {
    id: 'JV013',
    name: 'Hardcoded Password',
    pattern: /(?:String|final\s+String)\s+(?:password|passwd|pwd|secret)\s*=\s*["'][^"']{4,}["']/gi,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded password in source code',
    recommendation: 'Use environment variables, vault, or configuration service',
    fix: `String password = System.getenv("DB_PASSWORD");`,
  },
  {
    id: 'JV014',
    name: 'Hardcoded API Key',
    pattern: /(?:String|final\s+String)\s+(?:apiKey|api_key|ApiKey|API_KEY)\s*=\s*["'][A-Za-z0-9_\-]{20,}["']/g,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded API key in source code',
    recommendation: 'Use environment variables or a secrets manager',
  },
  {
    id: 'JV015',
    name: 'Hardcoded Token Pattern',
    pattern: /["'](?:sk_live_|sk_test_|ghp_|gho_|github_pat_|xoxb-|xoxp-|AKIA)[A-Za-z0-9_\-]+["']/g,
    severity: 'critical',
    category: 'secrets',
    cwe: 'CWE-798',
    owasp: 'A07:2021',
    description: 'Hardcoded service token detected',
    recommendation: 'Remove the token, rotate it, and use a secrets manager',
  },

  // Insecure Deserialization
  {
    id: 'JV016',
    name: 'Insecure Deserialization via ObjectInputStream',
    pattern: /(?:ObjectInputStream|OIS)\s*(?:\w+\s*=\s*)?(?:new\s+ObjectInputStream|\.readObject\s*\()/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-502',
    owasp: 'A08:2021',
    description: 'Java deserialization can execute arbitrary code',
    recommendation: 'Avoid ObjectInputStream for untrusted data; use JSON or an allow-list filter',
    fix: `// Use JSON instead:\nObjectMapper mapper = new ObjectMapper();\nUser user = mapper.readValue(jsonString, User.class);`,
  },
  {
    id: 'JV017',
    name: 'Insecure XMLDecoder Usage',
    pattern: /new\s+XMLDecoder\s*\(/gi,
    severity: 'critical',
    category: 'injection',
    cwe: 'CWE-502',
    owasp: 'A08:2021',
    description: 'XMLDecoder can execute arbitrary code during deserialization',
    recommendation: 'Avoid XMLDecoder for untrusted input; use JSON or validated XML',
  },

  // Path Traversal
  {
    id: 'JV018',
    name: 'Path Traversal via File Constructor',
    pattern: /new\s+File\s*\(\s*(?:[^"'][^)]*\+|[^)]*\.(?:getParameter|getHeader|getPathInfo))/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-22',
    owasp: 'A01:2021',
    description: 'File path constructed with potentially user-controlled input',
    recommendation: 'Canonicalize paths and verify they stay within allowed directories',
    fix: `// Validate path:\nFile file = new File(baseDir, userInput).getCanonicalFile();\nif (!file.getPath().startsWith(new File(baseDir).getCanonicalPath())) {\n  throw new SecurityException("Path traversal detected");\n}`,
  },
  {
    id: 'JV019',
    name: 'Path Traversal via Paths.get',
    pattern: /Paths\.get\s*\(\s*(?:[^"'][^)]*\+|[^)]*\.(?:getParameter|getHeader))/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-22',
    owasp: 'A01:2021',
    description: 'Path constructed with potentially user-controlled input',
    recommendation: 'Use Path.normalize() and verify against a base directory',
  },

  // Weak Cryptography
  {
    id: 'JV020',
    name: 'Weak Hash Algorithm (MD5)',
    pattern: /MessageDigest\.getInstance\s*\(\s*["']MD5["']\s*\)/gi,
    severity: 'high',
    category: 'cryptography',
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    description: 'MD5 is cryptographically broken',
    recommendation: 'Use SHA-256 or stronger',
  },
  {
    id: 'JV021',
    name: 'Weak Hash Algorithm (SHA-1)',
    pattern: /MessageDigest\.getInstance\s*\(\s*["']SHA-?1["']\s*\)/gi,
    severity: 'medium',
    category: 'cryptography',
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    description: 'SHA-1 is deprecated for security purposes',
    recommendation: 'Use SHA-256 or stronger',
  },
  {
    id: 'JV022',
    name: 'Weak Cipher (DES/DESede)',
    pattern: /Cipher\.getInstance\s*\(\s*["'](?:DES|DESede)(?:\/|\s*["'])/gi,
    severity: 'high',
    category: 'cryptography',
    cwe: 'CWE-327',
    owasp: 'A02:2021',
    description: 'DES/3DES ciphers are considered weak',
    recommendation: 'Use AES-256-GCM or ChaCha20-Poly1305',
  },
  {
    id: 'JV023',
    name: 'ECB Mode Cipher',
    pattern: /Cipher\.getInstance\s*\(\s*["'][^"']*\/ECB\//gi,
    severity: 'high',
    category: 'cryptography',
    cwe: 'CWE-327',
    owasp: 'A02:2021',
    description: 'ECB mode does not provide semantic security',
    recommendation: 'Use GCM, CTR, or CBC mode with proper IV handling',
  },

  // XSS
  {
    id: 'JV024',
    name: 'Potential XSS via Response Writer',
    pattern: /(?:response|resp|res)\.(?:getWriter|getOutputStream)\s*\(\s*\)\.(?:print|write|println)\s*\(\s*(?:req|request)\.(?:getParameter|getHeader)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-79',
    owasp: 'A03:2021',
    description: 'User input written directly to HTTP response',
    recommendation: 'HTML-encode user input before writing to response',
  },

  // TLS/SSL Configuration
  {
    id: 'JV025',
    name: 'TrustManager Accepting All Certificates',
    pattern: /new\s+X509TrustManager\s*\(\s*\)\s*\{[^}]*checkServerTrusted[^}]*\}/gi,
    severity: 'critical',
    category: 'cryptography',
    cwe: 'CWE-295',
    owasp: 'A02:2021',
    description: 'Custom TrustManager that accepts all certificates',
    recommendation: 'Use the default TrustManager or a properly configured custom one',
  },

  // Insecure Random
  {
    id: 'JV026',
    name: 'Insecure Random Number Generation',
    pattern: /new\s+(?:java\.util\.)?Random\s*\(/g,
    severity: 'medium',
    category: 'cryptography',
    cwe: 'CWE-330',
    owasp: 'A02:2021',
    description: 'java.util.Random is not cryptographically secure',
    recommendation: 'Use java.security.SecureRandom for security-sensitive operations',
    fix: `SecureRandom random = new SecureRandom();\nbyte[] bytes = new byte[32];\nrandom.nextBytes(bytes);`,
  },

  // LDAP Injection
  {
    id: 'JV027',
    name: 'LDAP Injection',
    pattern: /(?:search|lookup)\s*\(\s*(?:["'][^"']*["']\s*\+|String\.format\s*\(\s*["'][^"']*%s)/gi,
    severity: 'high',
    category: 'injection',
    cwe: 'CWE-90',
    owasp: 'A03:2021',
    description: 'LDAP query built with string concatenation or formatting',
    recommendation: 'Use parameterized LDAP queries and escape special characters',
  },
];

// ============================================================================
// Scanner Functions
// ============================================================================

export function scanJava(
  source: string,
  filePath: string = 'Source.java',
  options: JavaScanOptions = DEFAULT_OPTIONS
): JavaScanResult {
  const findings: Finding[] = [];
  const lines = source.split('\n');
  let patternsMatched = 0;

  for (const pattern of JAVA_PATTERNS) {
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
  options: JavaScanOptions
): boolean {
  if (pattern.id === 'JV001' || pattern.id === 'JV002' || pattern.id === 'JV003') {
    return options.checkSqlInjection !== false;
  }
  if (pattern.id === 'JV004' || pattern.id === 'JV005' || pattern.id === 'JV006') {
    return options.checkCommandInjection !== false;
  }
  if (pattern.id === 'JV007' || pattern.id === 'JV008' || pattern.id === 'JV009') {
    return options.checkXxe !== false;
  }
  if (pattern.id === 'JV010' || pattern.id === 'JV011' || pattern.id === 'JV012') {
    return options.checkSsrf !== false;
  }
  if (pattern.id === 'JV013' || pattern.id === 'JV014' || pattern.id === 'JV015') {
    return options.checkHardcodedSecrets !== false;
  }
  if (pattern.id === 'JV016' || pattern.id === 'JV017') {
    return options.checkInsecureDeserialize !== false;
  }
  if (pattern.id === 'JV018' || pattern.id === 'JV019') {
    return options.checkPathTraversal !== false;
  }
  if (pattern.id >= 'JV020' && pattern.id <= 'JV023' || pattern.id === 'JV025' || pattern.id === 'JV026') {
    return options.checkWeakCrypto !== false;
  }
  if (pattern.id === 'JV024') {
    return options.checkXss !== false;
  }

  return true;
}

function isInComment(line: string, column: number): boolean {
  const beforeColumn = line.substring(0, column);

  if (beforeColumn.includes('//')) {
    return true;
  }

  if (beforeColumn.includes('/*') && !beforeColumn.includes('*/')) {
    return true;
  }

  if (beforeColumn.trimStart().startsWith('*')) {
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

  if (lowerLine.includes('test') || lowerLine.includes('mock') || lowerLine.includes('fixture')) {
    return true;
  }

  if (pattern.category === 'secrets') {
    if (lowerLine.includes('system.getenv') || lowerLine.includes('system.getproperty')) {
      return true;
    }
    if (lowerMatch.includes('example') || lowerMatch.includes('placeholder') || lowerMatch.includes('xxx') || lowerMatch.includes('changeme')) {
      return true;
    }
  }

  // XXE: skip if setFeature is called nearby (same-line heuristic)
  if (pattern.id === 'JV007' || pattern.id === 'JV008' || pattern.id === 'JV009') {
    if (lowerLine.includes('setfeature') || lowerLine.includes('setproperty')) {
      return true;
    }
  }

  if (pattern.id === 'JV001' || pattern.id === 'JV003') {
    if (lowerLine.includes('preparedstatement') || lowerLine.includes('?')) {
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

export function getJavaPatternCount(): number {
  return JAVA_PATTERNS.length;
}

export function getJavaPatternsByCategory(category: string): VulnerabilityPattern[] {
  return JAVA_PATTERNS.filter((p) => p.category === category);
}
