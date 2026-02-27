/**
 * React Framework Adapter
 * Detects React-specific toast libraries and notification patterns
 */

import type { FrameworkType } from '../types.js';

/**
 * React toast library patterns
 */
export const REACT_TOAST_PATTERNS = {
  'react-hot-toast': {
    imports: ['toast', 'Toaster'],
    methods: ['toast.success', 'toast.error', 'toast'],
    confidence: 0.95,
  },
  'react-toastify': {
    imports: ['toast', 'ToastContainer'],
    methods: ['toast.success', 'toast.error', 'toast'],
    confidence: 0.95,
  },
  'sonner': {
    imports: ['toast', 'Toaster'],
    methods: ['toast.success', 'toast.error', 'toast'],
    confidence: 0.95,
  },
  'react-toast-notifications': {
    imports: ['useToasts', 'ToastProvider'],
    methods: ['addToast'],
    confidence: 0.9,
  },
  'notistack': {
    imports: ['useSnackbar', 'SnackbarProvider'],
    methods: ['enqueueSnackbar'],
    confidence: 0.9,
  },
  'antd': {
    imports: ['message', 'notification'],
    methods: ['message.success', 'notification.success'],
    confidence: 0.85,
  },
  'mui': {
    imports: ['useSnackbar', 'Snackbar'],
    methods: ['enqueueSnackbar'],
    confidence: 0.85,
  },
};

/**
 * Detect React framework from file content
 */
export function detectReactFramework(content: string): boolean {
  // Check for React imports
  if (!/from\s+['"]react['"]|import\s+\*\s+as\s+React/.test(content)) {
    return false;
  }

  // Check for React-specific patterns
  const reactPatterns = [
    /useState|useEffect|useCallback|useMemo/,
    /<[A-Z]\w+\s*\/?>/, // JSX
    /\.tsx|\.jsx/, // File extension hint (if available)
  ];

  return reactPatterns.some(pattern => pattern.test(content));
}

/**
 * Detect which React toast library is being used
 */
export function detectReactToastLibrary(content: string): {
  library: string;
  methods: string[];
  confidence: number;
} | null {
  for (const [library, config] of Object.entries(REACT_TOAST_PATTERNS)) {
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

  // Fallback: check for common toast method calls
  if (/toast\.(success|error|info|warning)/.test(content)) {
    return {
      library: 'unknown-react-toast',
      methods: ['toast.success', 'toast.error'],
      confidence: 0.7,
    };
  }

  return null;
}

/**
 * Check if a method call is a success notification
 */
export function isSuccessNotification(
  methodName: string,
  library?: string
): boolean {
  const successPatterns = [
    /\.success$/,
    /success/i,
    /showSuccess/i,
    /notifySuccess/i,
    /enqueueSnackbar.*success/i,
    /addToast.*success/i,
  ];

  return successPatterns.some(pattern => pattern.test(methodName));
}
