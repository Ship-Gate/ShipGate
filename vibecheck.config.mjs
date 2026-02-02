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
};
