// ============================================================================
// Themes Module - Export all themes
// ============================================================================

import type { ThemeConfig, ThemeName } from '../types';
import { defaultTheme, generateCSSVariables, generateTailwindConfig } from './default';
import { corporateTheme, corporateElements, generateCorporateHeader, generateCorporateFooter } from './corporate';

export { defaultTheme } from './default';
export { corporateTheme, corporateElements } from './corporate';

/**
 * All available themes
 */
export const themes: Record<ThemeName, ThemeConfig> = {
  default: defaultTheme,
  corporate: corporateTheme,
  minimal: createMinimalTheme(),
  dark: createDarkTheme(),
};

/**
 * Get theme by name
 */
export function getTheme(name: ThemeName): ThemeConfig {
  return themes[name] ?? defaultTheme;
}

/**
 * Merge theme with custom configuration
 */
export function mergeTheme(
  base: ThemeConfig,
  custom: Partial<ThemeConfig>
): ThemeConfig {
  return {
    ...base,
    name: custom.name ?? base.name,
    colors: { ...base.colors, ...custom.colors },
    fonts: { ...base.fonts, ...custom.fonts },
    code: { ...base.code, ...custom.code },
    layout: { ...base.layout, ...custom.layout },
    components: {
      callout: { ...base.components.callout, ...custom.components?.callout },
      card: { ...base.components.card, ...custom.components?.card },
      badge: { ...base.components.badge, ...custom.components?.badge },
    },
  };
}

/**
 * Generate theme files for a documentation site
 */
export function generateThemeFiles(theme: ThemeConfig): Array<{ path: string; content: string }> {
  return [
    {
      path: 'styles/theme.css',
      content: generateCSSVariables(theme),
    },
    {
      path: 'tailwind.config.js',
      content: generateTailwindConfig(theme),
    },
  ];
}

// ============================================================================
// ADDITIONAL THEMES
// ============================================================================

function createMinimalTheme(): ThemeConfig {
  return {
    name: 'minimal',
    colors: {
      primary: '#000000',
      secondary: '#4b5563',
      accent: '#000000',
      background: '#ffffff',
      foreground: '#111827',
      muted: '#9ca3af',
      border: '#f3f4f6',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
    },
    fonts: {
      sans: 'system-ui, -apple-system, sans-serif',
      mono: 'ui-monospace, monospace',
      heading: 'system-ui, -apple-system, sans-serif',
    },
    code: {
      theme: 'github-light',
      lineNumbers: false,
      copyButton: true,
    },
    layout: {
      maxWidth: '720px',
      sidebarWidth: '200px',
      tocWidth: '180px',
    },
    components: {
      callout: {
        info: 'border-l-2 border-gray-300 pl-4 text-gray-700',
        warning: 'border-l-2 border-amber-400 pl-4 text-amber-700',
        error: 'border-l-2 border-red-400 pl-4 text-red-700',
        tip: 'border-l-2 border-green-400 pl-4 text-green-700',
      },
      card: {
        default: 'border border-gray-100 rounded p-4',
        hover: 'hover:border-gray-300',
      },
      badge: {
        default: 'inline-flex items-center px-2 py-0.5 text-xs',
        primary: 'bg-gray-100 text-gray-800',
        success: 'bg-green-50 text-green-700',
        warning: 'bg-amber-50 text-amber-700',
        error: 'bg-red-50 text-red-700',
      },
    },
  };
}

function createDarkTheme(): ThemeConfig {
  return {
    name: 'dark',
    colors: {
      primary: '#60a5fa',
      secondary: '#818cf8',
      accent: '#22d3ee',
      background: '#0f172a',
      foreground: '#f1f5f9',
      muted: '#94a3b8',
      border: '#334155',
      success: '#4ade80',
      warning: '#fbbf24',
      error: '#f87171',
    },
    fonts: {
      sans: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      mono: '"Fira Code", "JetBrains Mono", monospace',
      heading: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    code: {
      theme: 'github-dark',
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
        info: 'bg-blue-900/30 border border-blue-700 text-blue-200',
        warning: 'bg-amber-900/30 border border-amber-700 text-amber-200',
        error: 'bg-red-900/30 border border-red-700 text-red-200',
        tip: 'bg-emerald-900/30 border border-emerald-700 text-emerald-200',
      },
      card: {
        default: 'bg-slate-800 border border-slate-700 rounded-lg shadow-lg',
        hover: 'hover:border-slate-600 hover:shadow-xl transition-all',
      },
      badge: {
        default: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        primary: 'bg-blue-900 text-blue-200',
        success: 'bg-green-900 text-green-200',
        warning: 'bg-yellow-900 text-yellow-200',
        error: 'bg-red-900 text-red-200',
      },
    },
  };
}

export { generateCSSVariables, generateTailwindConfig };
export { generateCorporateHeader, generateCorporateFooter };
