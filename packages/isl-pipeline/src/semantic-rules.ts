/**
 * Semantic Rule Validators
 * 
 * These are REAL checks, not string matching.
 * 
 * A rule passes only when:
 * - The semantic requirement is satisfied
 * - Not just "found the string @intent"
 * 
 * @module @isl-lang/pipeline
 */

// ============================================================================
// Types
// ============================================================================

export interface SemanticViolation {
  ruleId: string;
  file: string;
  line: number;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  fix?: string;
}

/**
 * Configuration for semantic rules
 */
export interface SemanticRuleConfig {
  /** Custom allowlist for stubs (file patterns) */
  stubAllowlist?: string[];
  /** Other rule-specific config */
  [key: string]: unknown;
}

export interface SemanticRule {
  id: string;
  description: string;
  /** Run the semantic check */
  check: (code: string, file: string, config?: SemanticRuleConfig) => SemanticViolation[];
}

// ============================================================================
// Semantic Rules - Real Checks, Not String Matching
// ============================================================================

export const SEMANTIC_RULES: SemanticRule[] = [
  // =========================================================================
  // intent/audit-required - SEMANTIC VERSION v2
  // Upgraded: Audit must happen on EVERY exit path with correct semantics
  // =========================================================================
  {
    id: 'intent/audit-required',
    description: 'Audit must be called on ALL exit paths with correct semantics (100% coverage)',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      // Skip test files, type files, and schema files
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      // Detect if this is a Next.js route handler or Express handler
      const isNextjsRouteHandler = /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)/i.test(code);
      const isExpressHandler = /\.(get|post|put|patch|delete)\s*\(/i.test(code);
      
      if (!isNextjsRouteHandler && !isExpressHandler) {
        return []; // Not a route handler
      }

      // =========================================================================
      // Phase 1: Extract all exit paths with context
      // =========================================================================
      const exitPaths = extractExitPaths(code);
      
      if (exitPaths.length === 0) return [];

      // =========================================================================
      // Phase 2: Check each exit path has an audit call before it
      // =========================================================================
      const unauditedPaths: ExitPath[] = [];
      
      for (const exitPath of exitPaths) {
        const hasAudit = checkPathHasAudit(code, exitPath);
        if (!hasAudit) {
          unauditedPaths.push(exitPath);
        }
      }

      // Require 100% coverage - every exit path must be audited
      if (unauditedPaths.length > 0) {
        for (const path of unauditedPaths) {
          violations.push({
            ruleId: 'intent/audit-required',
            file,
            line: path.line,
            message: `Missing audit on ${path.type} exit path`,
            severity: 'critical',
            evidence: path.code.trim().slice(0, 80),
            fix: `Add auditAttempt({ action: "${inferAction(file)}", success: ${path.isSuccessPath}, ${!path.isSuccessPath ? 'reason: "...", ' : ''}timestamp: Date.now(), requestId }) before return`,
          });
        }
      }

      // =========================================================================
      // Phase 3: Validate audit payload fields
      // =========================================================================
      const auditCalls = extractAuditCalls(code);
      
      for (const auditCall of auditCalls) {
        // Required fields check
        const requiredFields = ['action', 'success', 'timestamp'];
        const recommendedFields = ['requestId'];
        
        for (const field of requiredFields) {
          if (!auditCall.payload.includes(field)) {
            violations.push({
              ruleId: 'intent/audit-required',
              file,
              line: auditCall.line,
              message: `Audit payload missing required field: ${field}`,
              severity: 'critical',
              evidence: auditCall.payload.slice(0, 100),
              fix: `Add ${field} to audit payload`,
            });
          }
        }
        
        // Recommended fields (lower severity)
        for (const field of recommendedFields) {
          if (!auditCall.payload.includes(field) && !auditCall.payload.includes('correlationId')) {
            violations.push({
              ruleId: 'intent/audit-required',
              file,
              line: auditCall.line,
              message: `Audit payload missing recommended field: ${field} (or correlationId)`,
              severity: 'medium',
              evidence: auditCall.payload.slice(0, 100),
              fix: `Add ${field} for request tracing`,
            });
          }
        }

        // Check for failure paths missing reason
        const isFailurePath = auditCall.payload.includes('success: false') || 
                            auditCall.payload.includes('success:false');
        if (isFailurePath && !auditCall.payload.includes('reason')) {
          violations.push({
            ruleId: 'intent/audit-required',
            file,
            line: auditCall.line,
            message: 'Audit for failure path missing "reason" field',
            severity: 'high',
            evidence: auditCall.payload.slice(0, 100),
            fix: 'Add reason field explaining the failure (e.g., "validation_failed", "rate_limited")',
          });
        }
      }

      // =========================================================================
      // Phase 4: Validate success boolean correctness
      // =========================================================================
      const lines = code.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // Check for audit calls with success: true on error paths
        const errorPathPatterns = [
          { pattern: /status:\s*4\d\d/, type: '4xx error' },
          { pattern: /status:\s*5\d\d/, type: '5xx error' },
          { pattern: /\b429\b/, type: 'rate limit' },
          { pattern: /\b401\b|\b403\b/, type: 'auth error' },
          { pattern: /\b400\b/, type: 'validation error' },
        ];
        
        // Look in surrounding context (5 lines before AND 5 lines after)
        // The status code often comes AFTER the audit call on the return line
        const contextStart = Math.max(0, i - 5);
        const contextEnd = Math.min(lines.length, i + 6);
        const context = lines.slice(contextStart, contextEnd).join('\n');
        
        if (line.includes('success: true') || line.includes('success:true')) {
          for (const { pattern, type } of errorPathPatterns) {
            if (pattern.test(context)) {
              violations.push({
                ruleId: 'intent/audit-required',
                file,
                line: lineNum,
                message: `Audit has success:true on ${type} path (must be success:false)`,
                severity: 'critical',
                evidence: line.trim().slice(0, 80),
                fix: 'Change success: true to success: false on error paths',
              });
              break;
            }
          }
        }
        
        // Check for hardcoded success: true (should be dynamic based on operation result)
        if (/auditAttempt\s*\(\s*\{[^}]*success:\s*true[^}]*\}/.test(line)) {
          // Check if this is inside an error handling block
          const blockContext = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 3)).join('\n');
          const isInErrorBlock = /catch\s*\(|\.catch\(|\.catch\s*\(/i.test(blockContext) ||
            /throw\s+new|throw\s+Error/i.test(blockContext);
          if (isInErrorBlock) {
            violations.push({
              ruleId: 'intent/audit-required',
              file,
              line: lineNum,
              message: 'Audit with hardcoded success:true in error handling block',
              severity: 'critical',
              evidence: line.trim().slice(0, 80),
              fix: 'Use success: false in catch blocks and error handlers',
            });
          }
        }
      }

      // =========================================================================
      // Phase 5: Check for PII in audit payloads
      // =========================================================================
      const piiFields = ['email', 'password', 'ssn', 'creditCard', 'phone', 'address', 'token', 'secret', 'apiKey'];
      
      for (const auditCall of auditCalls) {
        for (const piiField of piiFields) {
          // Check for direct PII field inclusion
          const piiPatterns = [
            new RegExp(`\\b${piiField}\\b(?!.*redact|mask|hash)`, 'i'),
            new RegExp(`user\\.${piiField}`, 'i'),
            new RegExp(`req\\.body\\.${piiField}`, 'i'),
          ];
          
          for (const pattern of piiPatterns) {
            if (pattern.test(auditCall.payload)) {
              violations.push({
                ruleId: 'intent/audit-required',
                file,
                line: auditCall.line,
                message: `Potential PII (${piiField}) in audit payload - must not include sensitive data`,
                severity: 'critical',
                evidence: auditCall.payload.slice(0, 100),
                fix: `Remove ${piiField} from audit payload or use hashed/redacted version`,
              });
            }
          }
        }
      }

      return violations;
    },
  },

  // =========================================================================
  // intent/rate-limit-required - SEMANTIC VERSION
  // =========================================================================
  {
    id: 'intent/rate-limit-required',
    description: 'Rate limit must be checked BEFORE parsing body or hitting DB',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      const hasRateLimit = code.includes('rateLimit');
      const hasBodyParse = code.includes('request.json()') || code.includes('req.body');
      
      if (!hasRateLimit && hasBodyParse) {
        violations.push({
          ruleId: 'intent/rate-limit-required',
          file,
          line: 1,
          message: 'No rate limiting before body parsing',
          severity: 'high',
          evidence: 'Found request.json() but no rateLimit call',
          fix: 'Add rate limit check before parsing request body',
        });
        return violations;
      }

      if (hasRateLimit && hasBodyParse) {
        // Check ORDER: rateLimit must come BEFORE body parsing
        const rateLimitIdx = code.indexOf('rateLimit');
        const bodyParseIdx = code.indexOf('request.json()') !== -1 
          ? code.indexOf('request.json()') 
          : code.indexOf('req.body');

        if (rateLimitIdx > bodyParseIdx) {
          violations.push({
            ruleId: 'intent/rate-limit-required',
            file,
            line: findLineNumber(code, 'request.json()'),
            message: 'Rate limit check happens AFTER body parsing (must be before)',
            severity: 'critical',
            evidence: 'Body parsed before rate limit check',
            fix: 'Move rate limit check before request.json()',
          });
        }
      }

      // 429 path must audit with success:false
      const has429 = code.includes('429');
      if (has429) {
        const block429Start = code.indexOf('429');
        const block429Context = code.slice(Math.max(0, block429Start - 200), block429Start + 200);
        
        if (!block429Context.includes('audit')) {
          violations.push({
            ruleId: 'intent/rate-limit-required',
            file,
            line: findLineNumber(code, '429'),
            message: 'Rate limit 429 response must audit with success:false',
            severity: 'high',
            evidence: '429 response without audit call',
            fix: 'Add audit({ success: false, reason: "rate_limited" }) on 429 path',
          });
        }
      }

      return violations;
    },
  },

  // =========================================================================
  // intent/no-pii-logging - SEMANTIC VERSION (Comprehensive PII Protection)
  // =========================================================================
  {
    id: 'intent/no-pii-logging',
    description: 'No PII in logs - must use safe logger with redaction',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      // Skip test files, type files, and schema files
      if (file.includes('.test.') || file.includes('.spec.') || 
          file.includes('.types.') || file.includes('.schema.') ||
          file.includes('.d.ts')) {
        return [];
      }

      // =====================================================================
      // SINK DEFINITIONS: Where logging can happen
      // =====================================================================
      const LOG_SINKS = {
        // Console methods (FORBIDDEN in production)
        console: [
          { pattern: /console\.log\s*\(/g, method: 'console.log', severity: 'medium' as const },
          { pattern: /console\.error\s*\(/g, method: 'console.error', severity: 'high' as const },
          { pattern: /console\.warn\s*\(/g, method: 'console.warn', severity: 'medium' as const },
          { pattern: /console\.info\s*\(/g, method: 'console.info', severity: 'medium' as const },
          { pattern: /console\.debug\s*\(/g, method: 'console.debug', severity: 'low' as const },
          { pattern: /console\.trace\s*\(/g, method: 'console.trace', severity: 'medium' as const },
          { pattern: /console\.dir\s*\(/g, method: 'console.dir', severity: 'medium' as const },
          { pattern: /console\.table\s*\(/g, method: 'console.table', severity: 'medium' as const },
        ],
        // Logger methods (allowed but must redact PII)
        logger: [
          { pattern: /logger\.(log|info|warn|error|debug|trace|fatal)\s*\(/g, method: 'logger.*' },
          { pattern: /log\.(info|warn|error|debug|trace|fatal)\s*\(/g, method: 'log.*' },
          { pattern: /winston\.(log|info|warn|error|debug)\s*\(/g, method: 'winston.*' },
          { pattern: /pino\.(log|info|warn|error|debug|trace|fatal)\s*\(/g, method: 'pino.*' },
          { pattern: /bunyan\.(log|info|warn|error|debug|trace|fatal)\s*\(/g, method: 'bunyan.*' },
        ],
        // Audit metadata (must not contain raw PII)
        audit: [
          { pattern: /audit\s*\(\s*\{/g, method: 'audit()' },
          { pattern: /auditAttempt\s*\(\s*\{/g, method: 'auditAttempt()' },
          { pattern: /auditLog\s*\(/g, method: 'auditLog()' },
        ],
      };

      // =====================================================================
      // PII IDENTIFIER DEFINITIONS: What constitutes PII
      // =====================================================================
      const PII_IDENTIFIERS = {
        // Authentication/Authorization (CRITICAL)
        auth: {
          patterns: [
            /password/i, /passwd/i, /pwd\b/i,
            /\btoken\b/i, /accessToken/i, /refreshToken/i, /idToken/i, /bearerToken/i,
            /\bsecret\b/i, /apiSecret/i, /clientSecret/i,
            /credential/i, /\bauth\b/i,
            /authorization/i,
            /apiKey/i, /api_key/i,
            /privateKey/i, /private_key/i,
            /sessionId/i, /session_id/i,
          ],
          severity: 'critical' as const,
          category: 'authentication',
        },
        // Personal identifiers (HIGH)
        personal: {
          patterns: [
            /email/i, /e-mail/i, /emailAddress/i, /email_address/i,
            /\bssn\b/i, /socialSecurity/i, /social_security/i,
            /phone/i, /phoneNumber/i, /phone_number/i, /mobile/i, /cellphone/i,
            /\bname\b/i, /firstName/i, /first_name/i, /lastName/i, /last_name/i, /fullName/i, /full_name/i,
            /dateOfBirth/i, /date_of_birth/i, /\bdob\b/i, /birthDate/i, /birth_date/i,
            /nationalId/i, /national_id/i, /taxId/i, /tax_id/i,
            /passport/i, /passportNumber/i, /passport_number/i,
            /driverLicense/i, /driver_license/i, /driversLicense/i, /drivers_license/i,
          ],
          severity: 'high' as const,
          category: 'personal-info',
        },
        // Financial (HIGH)
        financial: {
          patterns: [
            /creditCard/i, /credit_card/i, /cardNumber/i, /card_number/i,
            /cvv/i, /cvc/i, /securityCode/i, /security_code/i,
            /bankAccount/i, /bank_account/i, /accountNumber/i, /account_number/i,
            /routingNumber/i, /routing_number/i,
            /iban/i, /swift/i, /bic\b/i,
          ],
          severity: 'critical' as const,
          category: 'financial',
        },
        // Network/Location (MEDIUM)
        network: {
          patterns: [
            /ipAddress/i, /ip_address/i, /\bip\b/i, /clientIp/i, /client_ip/i, /remoteAddr/i, /remote_addr/i,
            /userAgent/i, /user_agent/i,
            /\bgps\b/i, /latitude/i, /longitude/i, /location/i, /geolocation/i,
            /\baddress\b/i, /streetAddress/i, /street_address/i, /postalCode/i, /postal_code/i, /zipCode/i, /zip_code/i,
          ],
          severity: 'medium' as const,
          category: 'network-location',
        },
        // Request data (HIGH - may contain any PII)
        request: {
          patterns: [
            /req\.body\b/i, /request\.body\b/i, /requestBody/i, /request_body/i,
            /req\.headers\b/i, /request\.headers\b/i, /headers\[/i,
            /req\.query\b/i, /request\.query\b/i,
            /req\.params\b/i, /request\.params\b/i,
            /formData/i, /form_data/i,
            /rawBody/i, /raw_body/i,
          ],
          severity: 'high' as const,
          category: 'request-data',
        },
      };

      // =====================================================================
      // SAFE WRAPPERS: These are allowed and considered safe
      // =====================================================================
      const SAFE_WRAPPERS = [
        /safeLog\s*\(/,
        /safeLogger\./,
        /redact\s*\(/,
        /redactPii\s*\(/,
        /maskPii\s*\(/,
        /sanitize\s*\(/,
        /sanitizeLogs?\s*\(/,
        /safeError\s*\(/,
        /scrub\s*\(/,
        /mask\s*\(/,
        /obfuscate\s*\(/,
      ];

      // =====================================================================
      // RULE 1: Forbid all console.* in production code
      // =====================================================================
      for (const sink of LOG_SINKS.console) {
        const matches = [...code.matchAll(sink.pattern)];
        for (const match of matches) {
          const lineNum = findLineNumber(code, match[0]);
          const lineContent = getLineContent(code, lineNum);
          
          // Check if it's wrapped in a safe function (allowed in some cases)
          const isSafe = SAFE_WRAPPERS.some(wrapper => wrapper.test(lineContent));
          if (isSafe) continue;

          violations.push({
            ruleId: 'intent/no-pii-logging',
            file,
            line: lineNum,
            message: `${sink.method} in production code - use structured logger`,
            severity: sink.severity,
            evidence: lineContent.trim().slice(0, 100),
            fix: `Replace with logger.${sink.method.split('.')[1]}(safeError(data))`,
          });
        }
      }

      // =====================================================================
      // RULE 2: Forbid logging raw request body
      // =====================================================================
      const requestBodyPatterns = [
        { pattern: /console\.[a-z]+\s*\([^)]*req\.body/gi, sink: 'console' },
        { pattern: /console\.[a-z]+\s*\([^)]*request\.body/gi, sink: 'console' },
        { pattern: /console\.[a-z]+\s*\([^)]*requestBody/gi, sink: 'console' },
        { pattern: /logger\.[a-z]+\s*\([^)]*req\.body/gi, sink: 'logger' },
        { pattern: /logger\.[a-z]+\s*\([^)]*request\.body/gi, sink: 'logger' },
        { pattern: /logger\.[a-z]+\s*\([^)]*requestBody/gi, sink: 'logger' },
        { pattern: /log\.[a-z]+\s*\([^)]*req\.body/gi, sink: 'logger' },
        { pattern: /log\.[a-z]+\s*\([^)]*request\.body/gi, sink: 'logger' },
      ];

      for (const { pattern, sink } of requestBodyPatterns) {
        const matches = [...code.matchAll(pattern)];
        for (const match of matches) {
          const lineNum = findLineNumber(code, match[0]);
          const lineContent = getLineContent(code, lineNum);
          
          // Check for safe wrappers
          const isSafe = SAFE_WRAPPERS.some(wrapper => wrapper.test(lineContent));
          if (isSafe) continue;

          violations.push({
            ruleId: 'intent/no-pii-logging',
            file,
            line: lineNum,
            message: 'CRITICAL: Raw request body logged - may contain PII',
            severity: 'critical',
            evidence: lineContent.trim().slice(0, 100),
            fix: 'Use redact(req.body) or log only specific, safe fields',
          });
        }
      }

      // =====================================================================
      // RULE 3: Forbid logging request headers (may contain Authorization)
      // =====================================================================
      const headerPatterns = [
        /console\.[a-z]+\s*\([^)]*req\.headers/gi,
        /console\.[a-z]+\s*\([^)]*request\.headers/gi,
        /console\.[a-z]+\s*\([^)]*headers\[['"]authorization['"]\]/gi,
        /logger\.[a-z]+\s*\([^)]*req\.headers/gi,
        /logger\.[a-z]+\s*\([^)]*request\.headers/gi,
        /logger\.[a-z]+\s*\([^)]*headers\[['"]authorization['"]\]/gi,
      ];

      for (const pattern of headerPatterns) {
        const matches = [...code.matchAll(pattern)];
        for (const match of matches) {
          const lineNum = findLineNumber(code, match[0]);
          const lineContent = getLineContent(code, lineNum);
          
          const isSafe = SAFE_WRAPPERS.some(wrapper => wrapper.test(lineContent));
          if (isSafe) continue;

          violations.push({
            ruleId: 'intent/no-pii-logging',
            file,
            line: lineNum,
            message: 'CRITICAL: Request headers logged - may contain Authorization/tokens',
            severity: 'critical',
            evidence: lineContent.trim().slice(0, 100),
            fix: 'Never log raw headers. Extract only safe headers like Content-Type.',
          });
        }
      }

      // =====================================================================
      // RULE 4: Detect PII identifiers in any logging statement
      // =====================================================================
      const allLogPatterns = [
        /console\.[a-z]+\s*\([^)]*\)/gi,
        /logger\.[a-z]+\s*\([^)]*\)/gi,
        /log\.[a-z]+\s*\([^)]*\)/gi,
      ];

      for (const logPattern of allLogPatterns) {
        const logMatches = [...code.matchAll(logPattern)];
        
        for (const logMatch of logMatches) {
          const logStatement = logMatch[0];
          const lineNum = findLineNumber(code, logStatement);
          const lineContent = getLineContent(code, lineNum);
          
          // Skip if using safe wrapper
          const isSafe = SAFE_WRAPPERS.some(wrapper => wrapper.test(lineContent));
          if (isSafe) continue;

          // Check each PII category
          for (const [categoryName, category] of Object.entries(PII_IDENTIFIERS)) {
            for (const piiPattern of category.patterns) {
              if (piiPattern.test(logStatement)) {
                // Extract the matched field name
                const fieldMatch = logStatement.match(piiPattern);
                const fieldName = fieldMatch ? fieldMatch[0] : categoryName;

                violations.push({
                  ruleId: 'intent/no-pii-logging',
                  file,
                  line: lineNum,
                  message: `PII (${category.category}): "${fieldName}" may be logged`,
                  severity: category.severity,
                  evidence: lineContent.trim().slice(0, 100),
                  fix: `Use redact() wrapper or remove ${fieldName} from log`,
                });
                break; // One violation per log statement per category
              }
            }
          }
        }
      }

      // =====================================================================
      // RULE 5: Check audit metadata for raw PII
      // =====================================================================
      for (const auditSink of LOG_SINKS.audit) {
        const auditMatches = [...code.matchAll(auditSink.pattern)];
        
        for (const match of auditMatches) {
          const startIdx = match.index!;
          const endIdx = findClosingBrace(code, startIdx + match[0].length - 1);
          const auditPayload = code.slice(startIdx, endIdx + 1);

          // Check for raw PII in audit metadata
          for (const [, category] of Object.entries(PII_IDENTIFIERS)) {
            // Skip request category for audit (audit needs some context)
            if (category.category === 'request-data') continue;

            for (const piiPattern of category.patterns) {
              // Only flag if it looks like a value assignment, not just a field name
              const valuePatterns = [
                new RegExp(`${piiPattern.source}\\s*:\\s*[^,}]+`, 'i'),
                new RegExp(`['"]${piiPattern.source}['"]\\s*:\\s*[^,}]+`, 'i'),
              ];

              for (const valuePattern of valuePatterns) {
                if (valuePattern.test(auditPayload)) {
                  const fieldMatch = auditPayload.match(piiPattern);
                  const fieldName = fieldMatch ? fieldMatch[0] : 'unknown';
                  
                  // Check if it's already using redact/mask
                  const isSafe = SAFE_WRAPPERS.some(wrapper => 
                    wrapper.test(auditPayload.slice(
                      auditPayload.search(valuePattern),
                      auditPayload.search(valuePattern) + 50
                    ))
                  );
                  if (isSafe) continue;

                  violations.push({
                    ruleId: 'intent/no-pii-logging',
                    file,
                    line: findLineNumber(code, match[0]),
                    message: `PII in audit metadata: "${fieldName}" should be masked/redacted`,
                    severity: category.severity === 'critical' ? 'critical' : 'high',
                    evidence: auditPayload.slice(0, 100),
                    fix: `Use maskPii() or redact() for ${fieldName} in audit payload`,
                  });
                  break;
                }
              }
            }
          }
        }
      }

      return violations;
    },
  },

  // =========================================================================
  // quality/no-stubbed-handlers - CRITICAL RULE (Ship Blocker)
  // =========================================================================
  {
    id: 'quality/no-stubbed-handlers',
    description: 'No stubbed handlers or TODO markers can SHIP',
    check(code, file, config?: SemanticRuleConfig) {
      const violations: SemanticViolation[] = [];
      
      // Default allowlist - stubs allowed in tests, fixtures, and mocks
      const defaultAllowlist = [
        '.test.',
        '.spec.',
        '.types.',
        '.schema.',
        '.d.ts',
        '__mocks__',
        '__fixtures__',
        '/mocks/',
        '/fixtures/',
        '/test-fixtures/',
        '.mock.',
        '/demo/',
        '/examples/',
      ];

      // Merge with custom allowlist from config
      const allowlist = [
        ...defaultAllowlist,
        ...(config?.stubAllowlist || []),
      ];

      // Check if file is in allowlist
      const isAllowed = allowlist.some(pattern => file.includes(pattern));
      if (isAllowed) {
        return [];
      }

      // Pattern 1: throw new Error('Not implemented') and variations
      const notImplementedPatterns = [
        /throw\s+new\s+Error\s*\(\s*['"`]Not implemented['"`]\s*\)/gi,
        /throw\s+new\s+Error\s*\(\s*['"`]Not yet implemented['"`]\s*\)/gi,
        /throw\s+new\s+Error\s*\(\s*['"`]TODO['"`]\s*\)/gi,
        /throw\s+new\s+Error\s*\(\s*['"`]FIXME['"`]\s*\)/gi,
        /throw\s+new\s+Error\s*\(\s*['"`]STUB['"`]\s*\)/gi,
        /throw\s+new\s+Error\s*\(\s*['"`]PLACEHOLDER['"`]\s*\)/gi,
        /throw\s+['"`]Not implemented['"`]/gi,
      ];

      for (const pattern of notImplementedPatterns) {
        const matches = [...code.matchAll(pattern)];
        for (const match of matches) {
          violations.push({
            ruleId: 'quality/no-stubbed-handlers',
            file,
            line: findLineNumber(code, match[0]),
            message: 'SHIP BLOCKED: "Not implemented" error cannot ship - implementation required',
            severity: 'critical',
            evidence: match[0],
            fix: 'Implement the handler logic or remove the stub',
          });
        }
      }

      // Pattern 2: TODO markers under "ISL postconditions to satisfy"
      const todoPostconditionPatterns = [
        /\/\/\s*ISL postconditions[\s\S]{0,200}TODO/i,
        /\/\*\*?\s*ISL postconditions[\s\S]{0,200}TODO/i,
        /postconditions\s+to\s+satisfy[\s\S]{0,200}TODO/i,
        /\/\/\s*@postcondition[\s\S]{0,200}TODO/i,
      ];

      for (const pattern of todoPostconditionPatterns) {
        if (pattern.test(code)) {
          violations.push({
            ruleId: 'quality/no-stubbed-handlers',
            file,
            line: findLineNumber(code, 'TODO'),
            message: 'SHIP BLOCKED: TODO markers in postconditions section - must be implemented',
            severity: 'critical',
            evidence: 'Found TODO under ISL postconditions comment',
            fix: 'Implement all postconditions marked with TODO',
          });
          break; // Only report once per file
        }
      }

      // Pattern 3: Placeholder userLogin() that throws
      const placeholderHandlerPatterns = [
        /(?:async\s+)?(?:function\s+)?(?:userLogin|login|handleLogin)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{[^}]*throw\s+new\s+Error/gi,
        /(?:async\s+)?(?:function\s+)?(?:authenticate|authorize|checkAuth)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{[^}]*throw\s+new\s+Error/gi,
        /(?:async\s+)?(?:function\s+)?handle\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{[\s\n]*throw\s+new\s+Error/gi,
      ];

      for (const pattern of placeholderHandlerPatterns) {
        const matches = [...code.matchAll(pattern)];
        for (const match of matches) {
          // Extract function name
          const funcMatch = match[0].match(/(?:function\s+)?(\w+)\s*\(/i);
          const funcName = funcMatch?.[1] || 'handler';
          
          violations.push({
            ruleId: 'quality/no-stubbed-handlers',
            file,
            line: findLineNumber(code, match[0]),
            message: `SHIP BLOCKED: ${funcName}() is a placeholder that throws - implementation required`,
            severity: 'critical',
            evidence: `${funcName}() throws error instead of implementing logic`,
            fix: `Implement ${funcName}() with proper business logic`,
          });
        }
      }

      // Pattern 4: Generic placeholder comments
      const placeholderPatterns = [
        /\/\/\s*Implementation goes here/i,
        /\/\/\s*TODO:\s*implement\s*(this|handler|function|method)?/i,
        /\/\/\s*FIXME:\s*implement/i,
        /\/\/\s*placeholder\s*(implementation)?/i,
        /pass;?\s*\/\/\s*placeholder/i,
        /return\s*;?\s*\/\/\s*stub/i,
        /{\s*\/\/\s*TODO\s*}/,
      ];

      for (const pattern of placeholderPatterns) {
        if (pattern.test(code)) {
          const match = code.match(pattern);
          violations.push({
            ruleId: 'quality/no-stubbed-handlers',
            file,
            line: findLineNumber(code, match?.[0] || 'implement'),
            message: 'SHIP BLOCKED: Placeholder implementation cannot ship',
            severity: 'high',
            evidence: match?.[0] || 'Found placeholder comment',
            fix: 'Complete the implementation before shipping',
          });
        }
      }

      return violations;
    },
  },

  // =========================================================================
  // quality/validation-before-use - Input must be validated before use
  // =========================================================================
  {
    id: 'quality/validation-before-use',
    description: 'Input must be validated before use in business logic',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      const hasBodyParse = code.includes('request.json()') || code.includes('req.body');
      const hasValidation = code.includes('safeParse') || 
                           code.includes('.parse(') || 
                           code.includes('validate(');

      if (hasBodyParse && !hasValidation) {
        violations.push({
          ruleId: 'quality/validation-before-use',
          file,
          line: findLineNumber(code, 'request.json()') || findLineNumber(code, 'req.body'),
          message: 'Request body used without validation',
          severity: 'high',
          evidence: 'Found body parsing but no schema validation',
          fix: 'Add schema.safeParse(body) validation',
        });
      }

      return violations;
    },
  },

  // =========================================================================
  // intent/input-validation - SEMANTIC VERSION
  // =========================================================================
  {
    id: 'intent/input-validation',
    description: 'Input must be validated with schema before use',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      const hasBodyParse = code.includes('request.json()') || code.includes('req.body');
      if (!hasBodyParse) return [];

      // Check for schema validation patterns
      const hasSchemaValidation = 
        code.includes('safeParse') ||
        code.includes('.parse(') ||
        code.includes('validate(') ||
        code.includes('Zod') ||
        code.includes('yup.') ||
        code.includes('joi.');

      if (!hasSchemaValidation) {
        violations.push({
          ruleId: 'intent/input-validation',
          file,
          line: findLineNumber(code, 'request.json()') || findLineNumber(code, 'req.body'),
          message: 'Input not validated with schema before use',
          severity: 'high',
          evidence: 'Body parsing without schema validation',
          fix: 'Add schema validation (e.g., Schema.safeParse(body))',
        });
        return violations;
      }

      // Check validation happens BEFORE business logic
      const validationIdx = Math.min(
        code.indexOf('safeParse') !== -1 ? code.indexOf('safeParse') : Infinity,
        code.indexOf('.parse(') !== -1 ? code.indexOf('.parse(') : Infinity,
        code.indexOf('validate(') !== -1 ? code.indexOf('validate(') : Infinity
      );
      const bodyParseIdx = code.indexOf('request.json()') !== -1 
        ? code.indexOf('request.json()') 
        : code.indexOf('req.body');

      // Find first database or business logic call after body parse
      const dbPatterns = ['prisma.', 'db.', 'await db', 'findUnique', 'findMany', 'create(', 'update(', 'delete('];
      let firstDbCallIdx = Infinity;
      for (const pattern of dbPatterns) {
        const idx = code.indexOf(pattern);
        if (idx > bodyParseIdx && idx < firstDbCallIdx) {
          firstDbCallIdx = idx;
        }
      }

      if (validationIdx > firstDbCallIdx && firstDbCallIdx !== Infinity) {
        violations.push({
          ruleId: 'intent/input-validation',
          file,
          line: findLineNumber(code, 'safeParse'),
          message: 'Validation happens AFTER database call (must be before)',
          severity: 'critical',
          evidence: 'Database accessed before input validation',
          fix: 'Move validation before any database/business logic',
        });
      }

      // Check validation result is actually used (not ignored)
      if (code.includes('safeParse')) {
        const hasResultCheck = 
          code.includes('.success') ||
          code.includes('.error') ||
          code.includes('if (!validationResult') ||
          code.includes('if(!validationResult');
        
        if (!hasResultCheck) {
          violations.push({
            ruleId: 'intent/input-validation',
            file,
            line: findLineNumber(code, 'safeParse'),
            message: 'Validation result not checked (validation is useless)',
            severity: 'high',
            evidence: 'safeParse called but result not checked',
            fix: 'Check validationResult.success and handle errors',
          });
        }
      }

      return violations;
    },
  },

  // =========================================================================
  // intent/encryption-required - SEMANTIC VERSION
  // =========================================================================
  {
    id: 'intent/encryption-required',
    description: 'Sensitive data must be encrypted before storage',
    check(code, file) {
      const violations: SemanticViolation[] = [];
      
      if (file.includes('.test.') || file.includes('.types.') || file.includes('.schema.')) {
        return [];
      }

      // Detect sensitive data patterns that require encryption
      const sensitivePatterns = [
        { pattern: /password\s*[=:]/i, field: 'password', mustEncrypt: true },
        { pattern: /ssn\s*[=:]/i, field: 'ssn', mustEncrypt: true },
        { pattern: /creditCard\s*[=:]/i, field: 'creditCard', mustEncrypt: true },
        { pattern: /cardNumber\s*[=:]/i, field: 'cardNumber', mustEncrypt: true },
        { pattern: /secret\s*[=:]/i, field: 'secret', mustEncrypt: true },
        { pattern: /apiKey\s*[=:]/i, field: 'apiKey', mustEncrypt: true },
        { pattern: /privateKey\s*[=:]/i, field: 'privateKey', mustEncrypt: true },
      ];

      // Check if we have encryption utilities
      const hasEncryptionUtil = 
        code.includes('encrypt(') ||
        code.includes('crypto.') ||
        code.includes('bcrypt.') ||
        code.includes('argon2.') ||
        code.includes('hash(') ||
        code.includes('cipher');

      // Check for database storage operations
      const hasDbWrite = 
        code.includes('.create(') ||
        code.includes('.update(') ||
        code.includes('.upsert(') ||
        code.includes('INSERT') ||
        code.includes('UPDATE');

      if (!hasDbWrite) return [];

      for (const { pattern, field, mustEncrypt } of sensitivePatterns) {
        if (pattern.test(code) && mustEncrypt) {
          // Check if this field is being stored
          const fieldInDbWrite = new RegExp(`(create|update|upsert).*${field}`, 's').test(code);
          
          if (fieldInDbWrite && !hasEncryptionUtil) {
            violations.push({
              ruleId: 'intent/encryption-required',
              file,
              line: findLineNumber(code, field),
              message: `Sensitive field '${field}' stored without encryption`,
              severity: 'critical',
              evidence: `Found ${field} in database write without encryption`,
              fix: `Encrypt ${field} before storage (e.g., bcrypt.hash for passwords, encrypt() for other data)`,
            });
          }

          // Special check for password - must use proper hashing, not just encryption
          if (field === 'password') {
            const hasProperPasswordHash = 
              code.includes('bcrypt.hash') ||
              code.includes('argon2.hash') ||
              code.includes('scrypt');

            if (!hasProperPasswordHash && code.includes('password')) {
              violations.push({
                ruleId: 'intent/encryption-required',
                file,
                line: findLineNumber(code, 'password'),
                message: 'Password must use proper hashing (bcrypt/argon2), not encryption',
                severity: 'critical',
                evidence: 'Password handling without secure hash function',
                fix: 'Use bcrypt.hash() or argon2.hash() for password storage',
              });
            }
          }
        }
      }

      // Check if encryption key is hardcoded (critical security issue)
      const hardcodedKeyPatterns = [
        /encryptionKey\s*=\s*['"][^'"]{8,}['"]/i,
        /secret\s*=\s*['"][^'"]{8,}['"]/i,
        /key\s*=\s*['"][A-Za-z0-9+/=]{16,}['"]/,
      ];

      for (const pattern of hardcodedKeyPatterns) {
        if (pattern.test(code)) {
          violations.push({
            ruleId: 'intent/encryption-required',
            file,
            line: 1,
            message: 'Encryption key appears to be hardcoded (must use env variable)',
            severity: 'critical',
            evidence: 'Found hardcoded encryption key',
            fix: 'Move encryption key to environment variable (process.env.ENCRYPTION_KEY)',
          });
        }
      }

      return violations;
    },
  },
];

// ============================================================================
// Audit Rule Helpers - Exit Path Analysis
// ============================================================================

/**
 * Represents an exit path in a route handler
 */
interface ExitPath {
  line: number;
  code: string;
  type: 'success' | 'error' | 'rate_limit' | 'validation' | 'auth' | 'unknown';
  isSuccessPath: boolean;
  statusCode?: number;
}

/**
 * Represents an audit call with its payload
 */
interface AuditCall {
  line: number;
  payload: string;
  methodName: string;
}

/**
 * Extract all exit paths from code
 * Identifies return statements that return HTTP responses
 */
function extractExitPaths(code: string): ExitPath[] {
  const exitPaths: ExitPath[] = [];
  const lines = code.split('\n');
  
  // Patterns for HTTP response returns
  const returnPatterns = [
    // Next.js patterns
    /return\s+NextResponse\.json\s*\(/,
    /return\s+NextResponse\.(redirect|rewrite)\s*\(/,
    /return\s+new\s+NextResponse\s*\(/,
    /return\s+Response\.json\s*\(/,
    /return\s+new\s+Response\s*\(/,
    // Express patterns
    /return\s+res\.(json|send|status|end)\s*\(/,
    /res\.(json|send|status)\s*\([^)]*\)\s*;?\s*return/,
    // Generic JSON response
    /return\s+\{[^}]*status/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    for (const pattern of returnPatterns) {
      if (pattern.test(line)) {
        // Determine the type of exit path
        const exitPath = classifyExitPath(code, lines, i);
        exitPaths.push({
          line: lineNum,
          code: line,
          ...exitPath,
        });
        break;
      }
    }
  }
  
  return exitPaths;
}

/**
 * Classify an exit path as success, error, rate_limit, validation, auth, or unknown
 */
function classifyExitPath(
  _code: string,
  lines: string[],
  lineIndex: number
): { type: ExitPath['type']; isSuccessPath: boolean; statusCode?: number } {
  // Look at surrounding context (10 lines before, current line, 2 lines after)
  const contextStart = Math.max(0, lineIndex - 10);
  const contextEnd = Math.min(lines.length, lineIndex + 3);
  const context = lines.slice(contextStart, contextEnd).join('\n');
  const currentLine = lines[lineIndex];
  
  // Extract status code if present
  const statusMatch = context.match(/status[:\s]*(\d{3})/i) || currentLine.match(/(\d{3})/);
  const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
  
  // Rate limit detection
  if (/429|rate.?limit|too.?many|throttl/i.test(context)) {
    return { type: 'rate_limit', isSuccessPath: false, statusCode: statusCode || 429 };
  }
  
  // Auth error detection
  if (/401|403|unauthorized|forbidden|unauthenticated|not.?logged/i.test(context)) {
    return { type: 'auth', isSuccessPath: false, statusCode: statusCode || 401 };
  }
  
  // Validation error detection
  if (/400|validat|invalid|missing|required|bad.?request/i.test(context)) {
    return { type: 'validation', isSuccessPath: false, statusCode: statusCode || 400 };
  }
  
  // General error detection
  if (/4\d\d|5\d\d|error|fail|catch|throw|exception/i.test(context)) {
    return { type: 'error', isSuccessPath: false, statusCode };
  }
  
  // Success path (2xx or no explicit error)
  if (statusCode && statusCode >= 200 && statusCode < 300) {
    return { type: 'success', isSuccessPath: true, statusCode };
  }
  
  // Check for explicit success indicators
  if (/success|200|201|ok\b/i.test(context)) {
    return { type: 'success', isSuccessPath: true, statusCode: statusCode || 200 };
  }
  
  // Default - assume success if no error indicators
  return { type: 'unknown', isSuccessPath: true, statusCode };
}

/**
 * Check if an exit path has an audit call before it
 * Looks for audit/auditAttempt calls within 10 lines before the return
 * Also checks for audit in shared helper patterns
 */
function checkPathHasAudit(code: string, exitPath: ExitPath): boolean {
  const lines = code.split('\n');
  const lineIndex = exitPath.line - 1;
  
  // Check previous 10 lines for direct audit call
  const searchStart = Math.max(0, lineIndex - 10);
  const precedingLines = lines.slice(searchStart, lineIndex).join('\n');
  
  // Direct audit call patterns
  const auditPatterns = [
    /await\s+audit\s*\(/,
    /await\s+auditAttempt\s*\(/,
    /audit\s*\(\s*\{/,
    /auditAttempt\s*\(\s*\{/,
    /\.audit\s*\(/,
    /auditEvent\s*\(/,
  ];
  
  for (const pattern of auditPatterns) {
    if (pattern.test(precedingLines)) {
      return true;
    }
  }
  
  // Check for audit in a shared helper that wraps the return
  // Pattern: auditAndReturn(...) or similar helpers
  const helperPatterns = [
    /auditAnd(Return|Respond)/i,
    /withAudit\s*\(/i,
    /audit(ed)?Response/i,
  ];
  
  const currentLine = lines[lineIndex];
  for (const pattern of helperPatterns) {
    if (pattern.test(currentLine) || pattern.test(precedingLines)) {
      return true;
    }
  }
  
  // Check if there's a finally block or unified audit at function end
  // This handles the pattern where audit is in a finally{} or at the very end
  const functionContext = extractFunctionContext(code, lineIndex);
  if (functionContext) {
    const hasFinallyAudit = /finally\s*\{[^}]*audit/i.test(functionContext);
    if (hasFinallyAudit) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract the function context containing the given line
 */
function extractFunctionContext(code: string, lineIndex: number): string | null {
  const lines = code.split('\n');
  
  // Find function start (look backwards for function/async function/=>)
  let functionStart = -1;
  let braceDepth = 0;
  
  for (let i = lineIndex; i >= 0; i--) {
    const line = lines[i];
    braceDepth += (line.match(/\}/g) || []).length;
    braceDepth -= (line.match(/\{/g) || []).length;
    
    if (/^(export\s+)?(async\s+)?function\s+\w+|=>\s*\{|\(\s*\)\s*=>\s*\{/.test(line)) {
      functionStart = i;
      break;
    }
  }
  
  if (functionStart === -1) return null;
  
  // Find function end
  let functionEnd = lines.length - 1;
  braceDepth = 0;
  
  for (let i = functionStart; i < lines.length; i++) {
    const line = lines[i];
    braceDepth += (line.match(/\{/g) || []).length;
    braceDepth -= (line.match(/\}/g) || []).length;
    
    if (braceDepth === 0 && i > functionStart) {
      functionEnd = i;
      break;
    }
  }
  
  return lines.slice(functionStart, functionEnd + 1).join('\n');
}

/**
 * Extract all audit calls from code with their payloads
 */
function extractAuditCalls(code: string): AuditCall[] {
  const calls: AuditCall[] = [];
  const lines = code.split('\n');
  
  // Match audit call patterns
  const auditCallPattern = /(await\s+)?(audit|auditAttempt|auditEvent)\s*\(/g;
  
  let match;
  while ((match = auditCallPattern.exec(code)) !== null) {
    const callStart = match.index;
    const methodName = match[2];
    
    // Find the closing parenthesis
    const callEnd = findClosingParen(code, callStart + match[0].length - 1);
    const payload = code.slice(callStart, callEnd + 1);
    
    // Calculate line number
    const lineNum = code.slice(0, callStart).split('\n').length;
    
    calls.push({
      line: lineNum,
      payload,
      methodName,
    });
  }
  
  return calls;
}

/**
 * Infer the action name from the file path
 */
function inferAction(file: string): string {
  // Extract meaningful parts from the path
  const parts = file.replace(/\\/g, '/').split('/');
  const fileName = parts[parts.length - 1].replace(/\.(ts|tsx|js|jsx)$/, '');
  
  // Common patterns
  if (fileName === 'route') {
    // Next.js App Router - use parent folder name
    const parentFolder = parts[parts.length - 2];
    return parentFolder || 'api_request';
  }
  
  // Map common file names to actions
  const actionMap: Record<string, string> = {
    'login': 'user_login',
    'logout': 'user_logout',
    'register': 'user_register',
    'signup': 'user_signup',
    'checkout': 'payment_checkout',
    'payment': 'payment_process',
    'webhook': 'webhook_received',
    'users': 'user_operation',
    'admin': 'admin_operation',
  };
  
  for (const [key, action] of Object.entries(actionMap)) {
    if (fileName.toLowerCase().includes(key)) {
      return action;
    }
  }
  
  return `${fileName.replace(/[-_]/g, '_')}_request`;
}

// ============================================================================
// Helpers
// ============================================================================

function findLineNumber(code: string, search: string): number {
  const idx = code.indexOf(search);
  if (idx === -1) return 1;
  return code.slice(0, idx).split('\n').length;
}

function getLineContent(code: string, lineNum: number): string {
  const lines = code.split('\n');
  return lines[lineNum - 1] || '';
}

function findClosingParen(code: string, startIdx: number): number {
  let depth = 1;
  for (let i = startIdx + 1; i < code.length; i++) {
    if (code[i] === '(') depth++;
    if (code[i] === ')') depth--;
    if (depth === 0) return i;
  }
  return code.length;
}

function findClosingBrace(code: string, startIdx: number): number {
  let depth = 1;
  for (let i = startIdx + 1; i < code.length; i++) {
    if (code[i] === '{') depth++;
    if (code[i] === '}') depth--;
    if (depth === 0) return i;
  }
  return code.length;
}

// ============================================================================
// Run All Semantic Rules
// ============================================================================

export function runSemanticRules(
  codeMap: Map<string, string>,
  config?: SemanticRuleConfig
): SemanticViolation[] {
  // Try cache first (if available)
  try {
    const { getGateCache } = require('./performance/cache.js');
    const gateCache = getGateCache();
    const cached = gateCache.get(codeMap);
    if (cached) {
      return cached;
    }
  } catch {
    // Cache not available, continue
  }

  const violations: SemanticViolation[] = [];

  for (const [file, code] of codeMap) {
    for (const rule of SEMANTIC_RULES) {
      violations.push(...rule.check(code, file, config));
    }
  }

  // Cache result (if available)
  try {
    const { getGateCache } = require('./performance/cache.js');
    const gateCache = getGateCache();
    gateCache.set(codeMap, violations);
  } catch {
    // Cache not available, continue
  }

  return violations;
}

// ============================================================================
// Proof Bundle Completeness Check
// ============================================================================

export interface ProofCompletenessResult {
  complete: boolean;
  status: 'PROVEN' | 'INCOMPLETE_PROOF' | 'UNPROVEN';
  missing: string[];
  warnings: string[];
}

export function checkProofCompleteness(proof: {
  gateScore: number;
  gateVerdict: string;
  testsPassed: number;
  testsFailed: number;
  typecheckPassed: boolean;
  buildPassed: boolean;
  hasStubs: boolean;
}): ProofCompletenessResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Gate must pass
  if (proof.gateVerdict !== 'SHIP') {
    missing.push('Gate verdict is not SHIP');
  }

  // Tests must have run (0 tests = incomplete)
  if (proof.testsPassed === 0 && proof.testsFailed === 0) {
    missing.push('No tests ran - proof requires test execution');
  }

  // Tests must pass
  if (proof.testsFailed > 0) {
    missing.push(`${proof.testsFailed} tests failed`);
  }

  // Typecheck must pass
  if (!proof.typecheckPassed) {
    missing.push('TypeScript compilation failed');
  }

  // Build must pass
  if (!proof.buildPassed) {
    missing.push('Build failed');
  }

  // No stubs allowed
  if (proof.hasStubs) {
    missing.push('Code contains stubbed handlers');
  }

  // Warnings
  if (proof.testsPassed < 3) {
    warnings.push('Low test coverage - consider adding more tests');
  }

  const complete = missing.length === 0;
  const status = complete ? 'PROVEN' : 
                 proof.gateVerdict === 'SHIP' ? 'INCOMPLETE_PROOF' : 
                 'UNPROVEN';

  return { complete, status, missing, warnings };
}
