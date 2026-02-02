/** @type {import('vibecheck-ai').VibeCheckConfig} */
export default {
  // Enable all scanners
  rules: ['routes', 'env', 'auth', 'contracts', 'ui'],
  
  // Strict mode for maximum validation
  strict: true,
  
  output: 'pretty',
  truthpackPath: '.vibecheck/truthpack',
  
  watch: {
    include: ['src/**/*.ts', 'src/**/*.tsx'],
    exclude: ['node_modules', 'dist', 'build'],
    debounce: 200, // Faster response
  },
  
  validation: {
    failFast: true, // Stop on first error
    maxErrors: 10,
    timeout: 30000,
  },
  
  firewall: {
    enabled: true,
    blockOnViolation: true,
    strictness: 'high',
  },
  
  scan: {
    timeout: 60000,
    maxFiles: 5000,
    followSymlinks: false,
  },
  
  // Opt-in telemetry (disabled by default)
  telemetry: {
    enabled: false,
    crashReports: false,
  },

  // ============================================================================
  // ISL Studio Integration
  // ============================================================================
  // When enabled, VibeCheck firewall runs ISL Studio policy packs alongside
  // truthpack validation for comprehensive code governance.
  islStudio: {
    enabled: true,
    
    // Policy packs to enable
    packs: {
      auth: true,        // Auth bypass, hardcoded credentials
      pii: true,         // Logged PII, console.log in production
      payments: true,    // Client-side amounts, missing idempotency
      'rate-limit': true, // Missing rate limiting on auth endpoints
      intent: true,      // Intent enforcement from ISL specs
    },
    
    // Severity overrides (optional)
    // severity: {
    //   'pii/console-in-production': 'warn',
    // },
    
    // Generate evidence bundles
    evidence: {
      enabled: true,
      outputPath: '.vibecheck/evidence',
    },
    
    // SARIF output for GitHub Security tab
    sarif: {
      enabled: true,
      outputPath: '.vibecheck/results.sarif',
    },
  },
};
