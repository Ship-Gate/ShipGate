// ============================================================================
// Default Theme - Clean and professional documentation theme
// ============================================================================

import type { ThemeConfig } from '../types';

export const defaultTheme: ThemeConfig = {
  name: 'default',
  
  colors: {
    primary: '#3b82f6',      // Blue 500
    secondary: '#6366f1',    // Indigo 500
    accent: '#06b6d4',       // Cyan 500
    background: '#ffffff',   // White
    foreground: '#1f2937',   // Gray 800
    muted: '#6b7280',        // Gray 500
    border: '#e5e7eb',       // Gray 200
    success: '#10b981',      // Emerald 500
    warning: '#f59e0b',      // Amber 500
    error: '#ef4444',        // Red 500
  },
  
  fonts: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
    heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  
  code: {
    theme: 'github-light',
    lineNumbers: true,
    copyButton: true,
  },
  
  layout: {
    maxWidth: '1400px',
    sidebarWidth: '260px',
    tocWidth: '220px',
  },
  
  components: {
    callout: {
      info: 'bg-blue-50 border-blue-200 text-blue-800',
      warning: 'bg-amber-50 border-amber-200 text-amber-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      tip: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    },
    card: {
      default: 'bg-white border border-gray-200 rounded-lg shadow-sm',
      hover: 'hover:shadow-md transition-shadow',
    },
    badge: {
      default: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      primary: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    },
  },
};

/**
 * Generate CSS variables from theme
 */
export function generateCSSVariables(theme: ThemeConfig): string {
  return `
:root {
  --color-primary: ${theme.colors.primary};
  --color-secondary: ${theme.colors.secondary};
  --color-accent: ${theme.colors.accent};
  --color-background: ${theme.colors.background};
  --color-foreground: ${theme.colors.foreground};
  --color-muted: ${theme.colors.muted};
  --color-border: ${theme.colors.border};
  --color-success: ${theme.colors.success};
  --color-warning: ${theme.colors.warning};
  --color-error: ${theme.colors.error};
  
  --font-sans: ${theme.fonts.sans};
  --font-mono: ${theme.fonts.mono};
  --font-heading: ${theme.fonts.heading};
  
  --layout-max-width: ${theme.layout.maxWidth};
  --layout-sidebar-width: ${theme.layout.sidebarWidth};
  --layout-toc-width: ${theme.layout.tocWidth};
}
`;
}

/**
 * Generate Tailwind configuration from theme
 */
export function generateTailwindConfig(theme: ThemeConfig): string {
  return `
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '${theme.colors.primary}',
        secondary: '${theme.colors.secondary}',
        accent: '${theme.colors.accent}',
        background: '${theme.colors.background}',
        foreground: '${theme.colors.foreground}',
        muted: '${theme.colors.muted}',
        border: '${theme.colors.border}',
        success: '${theme.colors.success}',
        warning: '${theme.colors.warning}',
        error: '${theme.colors.error}',
      },
      fontFamily: {
        sans: ['${theme.fonts.sans.split(',')[0]?.trim()}', 'sans-serif'],
        mono: ['${theme.fonts.mono.split(',')[0]?.trim()}', 'monospace'],
        heading: ['${theme.fonts.heading.split(',')[0]?.trim()}', 'sans-serif'],
      },
    },
  },
};
`;
}

export default defaultTheme;
