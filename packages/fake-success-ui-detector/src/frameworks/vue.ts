/**
 * Vue Framework Adapter
 * Detects Vue-specific notification patterns
 */

/**
 * Vue notification library patterns
 */
export const VUE_NOTIFICATION_PATTERNS = {
  'vue-toastification': {
    imports: ['useToast'],
    methods: ['toast.success', 'toast.error'],
    confidence: 0.95,
  },
  'vue-toast-notification': {
    imports: ['useToast'],
    methods: ['toast.success', 'toast.error'],
    confidence: 0.9,
  },
  'element-plus': {
    imports: ['ElMessage', 'ElNotification'],
    methods: ['ElMessage.success', 'ElNotification.success'],
    confidence: 0.85,
  },
  'vuetify': {
    imports: ['useSnackbar'],
    methods: ['snackbar.show'],
    confidence: 0.85,
  },
};

/**
 * Detect Vue framework from file content
 */
export function detectVueFramework(content: string): boolean {
  // Check for Vue imports
  if (!/from\s+['"]vue['"]|import\s+.*\s+from\s+['"]@vue/.test(content)) {
    return false;
  }

  // Check for Vue-specific patterns
  const vuePatterns = [
    /defineComponent|setup\(|ref\(|reactive\(|computed\(/,
    /<template>|<script\s+setup/,
  ];

  return vuePatterns.some(pattern => pattern.test(content));
}

/**
 * Detect which Vue notification library is being used
 */
export function detectVueNotificationLibrary(content: string): {
  library: string;
  methods: string[];
  confidence: number;
} | null {
  for (const [library, config] of Object.entries(VUE_NOTIFICATION_PATTERNS)) {
    const importPattern = new RegExp(
      `import\\s+.*\\s+from\\s+['"]${library.replace(/-/g, '[-_]')}['"]`,
      'i'
    );
    if (importPattern.test(content)) {
      return {
        library,
        methods: config.methods,
        confidence: config.confidence,
      };
    }
  }

  return null;
}
