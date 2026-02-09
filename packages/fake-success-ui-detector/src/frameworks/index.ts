/**
 * Framework Detection
 */

import type { FrameworkType } from '../types.js';
import {
  detectReactFramework,
  detectReactToastLibrary,
  isSuccessNotification as isReactSuccessNotification,
} from './react.js';
import {
  detectVueFramework,
  detectVueNotificationLibrary,
} from './vue.js';
import { detectGenericNotifications } from './generic.js';

/**
 * Detect framework from file content
 */
export function detectFramework(content: string, filePath?: string): {
  framework: FrameworkType;
  library?: string;
  methods?: string[];
  confidence: number;
} {
  // Check file extension if available
  if (filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      const reactLib = detectReactToastLibrary(content);
      if (reactLib) {
        return {
          framework: 'react',
          library: reactLib.library,
          methods: reactLib.methods,
          confidence: reactLib.confidence,
        };
      }
      if (detectReactFramework(content)) {
        return {
          framework: 'react',
          confidence: 0.8,
        };
      }
    }
    if (filePath.endsWith('.vue')) {
      const vueLib = detectVueNotificationLibrary(content);
      if (vueLib) {
        return {
          framework: 'vue',
          library: vueLib.library,
          methods: vueLib.methods,
          confidence: vueLib.confidence,
        };
      }
      if (detectVueFramework(content)) {
        return {
          framework: 'vue',
          confidence: 0.8,
        };
      }
    }
  }

  // Try React detection
  if (detectReactFramework(content)) {
    const reactLib = detectReactToastLibrary(content);
    if (reactLib) {
      return {
        framework: 'react',
        library: reactLib.library,
        methods: reactLib.methods,
        confidence: reactLib.confidence,
      };
    }
    return {
      framework: 'react',
      confidence: 0.7,
    };
  }

  // Try Vue detection
  if (detectVueFramework(content)) {
    const vueLib = detectVueNotificationLibrary(content);
    if (vueLib) {
      return {
        framework: 'vue',
        library: vueLib.library,
        methods: vueLib.methods,
        confidence: vueLib.confidence,
      };
    }
    return {
      framework: 'vue',
      confidence: 0.7,
    };
  }

  // Check for generic notifications
  const genericNotifications = detectGenericNotifications(content);
  if (genericNotifications.length > 0) {
    return {
      framework: 'generic',
      confidence: 0.6,
    };
  }

  return {
    framework: 'unknown',
    confidence: 0.3,
  };
}

/**
 * Check if a method call is a success notification
 */
export function isSuccessNotification(
  methodName: string,
  framework: FrameworkType,
  library?: string
): boolean {
  if (framework === 'react') {
    return isReactSuccessNotification(methodName, library);
  }

  // Generic success patterns
  return /\.success$|success\(|Success\(/i.test(methodName);
}

export * from './react.js';
export * from './vue.js';
export * from './generic.js';
