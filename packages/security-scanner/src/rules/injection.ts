// ============================================================================
// Injection Security Rules
// SEC008: SQL Injection
// ============================================================================

import {
  SecurityRule,
  Finding,
  RuleContext,
} from '../severity';

// ============================================================================
// Pattern Definitions
// ============================================================================

interface InjectionPattern {
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium';
  cwe: string;
  description: string;
}

const SQL_INJECTION_PATTERNS: InjectionPattern[] = [
  {
    name: 'String concatenation in SQL',
    pattern: /["'`]SELECT\s+.+\s+FROM\s+.+["'`]\s*\+/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    description: 'SQL query built using string concatenation with user input',
  },
  {
    name: 'Template literal SQL',
    pattern: /`SELECT\s+.+\s+FROM\s+.+\$\{/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    description: 'SQL query built using template literals with interpolated values',
  },
  {
    name: 'f-string SQL (Python)',
    pattern: /f["']SELECT\s+.+\s+FROM\s+.+\{/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    description: 'SQL query built using Python f-strings with interpolated values',
  },
  {
    name: 'Format string SQL (Python)',
    pattern: /["']SELECT\s+.+\s+FROM\s+.+["']\.format\(/gi,
    severity: 'critical',
    cwe: 'CWE-89',
    description: 'SQL query built using Python .format() with user input',
  },
  {
    name: 'Percent formatting SQL (Python)',
    pattern: /["']SELECT\s+.+\s+FROM\s+.+%s/gi,
    severity: 'high',
    cwe: 'CWE-89',
    description: 'SQL query built using percent formatting',
  },
];

const NOSQL_INJECTION_PATTERNS: InjectionPattern[] = [
  {
    name: 'NoSQL $where injection',
    pattern: /\$where\s*:\s*['"]/gi,
    severity: 'critical',
    cwe: 'CWE-943',
    description: 'MongoDB $where clause with string expression',
  },
  {
    name: 'Unsafe MongoDB query',
    pattern: /\.find\(\s*\{\s*\$where/gi,
    severity: 'critical',
    cwe: 'CWE-943',
    description: 'MongoDB find with $where clause',
  },
];

const COMMAND_INJECTION_PATTERNS: InjectionPattern[] = [
  {
    name: 'exec with string concatenation',
    pattern: /exec\s*\(\s*["'`].+["'`]\s*\+/gi,
    severity: 'critical',
    cwe: 'CWE-78',
    description: 'Command execution with string concatenation',
  },
  {
    name: 'spawn with user input',
    pattern: /spawn\s*\(\s*["'`].+\$\{/gi,
    severity: 'critical',
    cwe: 'CWE-78',
    description: 'Process spawn with interpolated values',
  },
  {
    name: 'os.system (Python)',
    pattern: /os\.system\s*\(\s*f?["'].+\{/gi,
    severity: 'critical',
    cwe: 'CWE-78',
    description: 'Python os.system with user input',
  },
  {
    name: 'subprocess.call (Python)',
    pattern: /subprocess\.(?:call|run|Popen)\s*\(\s*f?["'].+\{/gi,
    severity: 'critical',
    cwe: 'CWE-78',
    description: 'Python subprocess with interpolated shell command',
  },
];

const LDAP_INJECTION_PATTERNS: InjectionPattern[] = [
  {
    name: 'LDAP filter concatenation',
    pattern: /\(\s*["'`]\(.+\)["'`]\s*\+/gi,
    severity: 'high',
    cwe: 'CWE-90',
    description: 'LDAP filter built using string concatenation',
  },
];

const XPATH_INJECTION_PATTERNS: InjectionPattern[] = [
  {
    name: 'XPath concatenation',
    pattern: /xpath\s*\(\s*["'`].+["'`]\s*\+/gi,
    severity: 'high',
    cwe: 'CWE-643',
    description: 'XPath query built using string concatenation',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function findPatternMatches(
  source: string,
  patterns: InjectionPattern[],
  fileLocation: string
): Finding[] {
  const findings: Finding[] = [];
  const lines = source.split('\n');

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

    while ((match = regex.exec(source)) !== null) {
      // Calculate line number
      const beforeMatch = source.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const line = lines[lineNumber - 1] || '';
      const column = match.index - beforeMatch.lastIndexOf('\n');

      findings.push({
        id: 'SEC008',
        title: 'SQL/NoSQL/Command Injection',
        severity: pattern.severity,
        category: 'injection',
        location: {
          file: fileLocation,
          startLine: lineNumber,
          startColumn: column,
          endLine: lineNumber,
          endColumn: column + match[0].length,
        },
        description: `${pattern.description}: "${match[0].substring(0, 50)}..."`,
        recommendation:
          'Use parameterized queries or prepared statements instead of string concatenation. ' +
          'Never interpolate user input directly into queries.',
        cwe: pattern.cwe,
        owasp: 'A03:2021',
        fix: getFixSuggestion(pattern.cwe, line),
        context: {
          matchedPattern: pattern.name,
          matchedText: match[0].substring(0, 100),
        },
      });
    }
  }

  return findings;
}

function getFixSuggestion(cwe: string, _line: string): string {
  switch (cwe) {
    case 'CWE-89':
      return (
        '// Use parameterized query:\n' +
        '// Bad:  db.query("SELECT * FROM users WHERE id = " + userId)\n' +
        '// Good: db.query("SELECT * FROM users WHERE id = $1", [userId])'
      );
    case 'CWE-943':
      return (
        '// Use safe query methods:\n' +
        '// Bad:  collection.find({ $where: "this.id == " + id })\n' +
        '// Good: collection.find({ id: id })'
      );
    case 'CWE-78':
      return (
        '// Use safe subprocess execution:\n' +
        '// Bad:  exec("ls " + userInput)\n' +
        '// Good: spawn("ls", [userInput], { shell: false })'
      );
    default:
      return '// Use parameterized queries and never interpolate user input';
  }
}

// ============================================================================
// SEC008: SQL Injection
// ============================================================================

export const SEC008_SQLInjection: SecurityRule = {
  id: 'SEC008',
  title: 'SQL Injection',
  description:
    'String concatenation or interpolation used in SQL queries. ' +
    'This can lead to SQL injection attacks allowing data theft or manipulation.',
  severity: 'critical',
  category: 'injection',
  cwe: 'CWE-89',
  owasp: 'A03:2021',

  check(context: RuleContext): Finding[] {
    const { implementation, options } = context;

    if (!options.scanImplementations || !implementation) {
      return [];
    }

    const allPatterns = [
      ...SQL_INJECTION_PATTERNS,
      ...NOSQL_INJECTION_PATTERNS,
      ...COMMAND_INJECTION_PATTERNS,
      ...LDAP_INJECTION_PATTERNS,
      ...XPATH_INJECTION_PATTERNS,
    ];

    const fileLocation = options.implementationLanguage === 'python'
      ? 'implementation.py'
      : 'implementation.ts';

    return findPatternMatches(implementation, allPatterns, fileLocation);
  },
};

// ============================================================================
// Export All Injection Rules
// ============================================================================

export const injectionRules: SecurityRule[] = [
  SEC008_SQLInjection,
];
