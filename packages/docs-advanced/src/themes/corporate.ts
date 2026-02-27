// ============================================================================
// Corporate Theme - Professional enterprise documentation theme
// ============================================================================

import type { ThemeConfig } from '../types';

export const corporateTheme: ThemeConfig = {
  name: 'corporate',
  
  colors: {
    primary: '#1e40af',      // Blue 800 - More formal
    secondary: '#0f766e',    // Teal 700
    accent: '#0284c7',       // Sky 600
    background: '#f8fafc',   // Slate 50
    foreground: '#0f172a',   // Slate 900
    muted: '#64748b',        // Slate 500
    border: '#cbd5e1',       // Slate 300
    success: '#15803d',      // Green 700
    warning: '#b45309',      // Amber 700
    error: '#b91c1c',        // Red 700
  },
  
  fonts: {
    sans: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"IBM Plex Mono", Menlo, Monaco, Consolas, monospace',
    heading: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  
  code: {
    theme: 'github-dark',
    lineNumbers: true,
    copyButton: true,
  },
  
  layout: {
    maxWidth: '1280px',
    sidebarWidth: '280px',
    tocWidth: '240px',
  },
  
  components: {
    callout: {
      info: 'bg-blue-50 border-l-4 border-blue-600 text-blue-900',
      warning: 'bg-amber-50 border-l-4 border-amber-600 text-amber-900',
      error: 'bg-red-50 border-l-4 border-red-600 text-red-900',
      tip: 'bg-teal-50 border-l-4 border-teal-600 text-teal-900',
    },
    card: {
      default: 'bg-white border border-slate-200 rounded shadow-sm',
      hover: 'hover:border-primary hover:shadow transition-all',
    },
    badge: {
      default: 'inline-flex items-center px-3 py-1 rounded text-xs font-semibold uppercase tracking-wide',
      primary: 'bg-blue-900 text-white',
      success: 'bg-green-800 text-white',
      warning: 'bg-amber-700 text-white',
      error: 'bg-red-800 text-white',
    },
  },
};

/**
 * Corporate-specific documentation elements
 */
export const corporateElements = {
  /**
   * Disclaimer block for legal compliance
   */
  disclaimer: `
<div class="disclaimer bg-slate-100 border border-slate-300 rounded-lg p-4 my-6">
  <div class="flex items-start gap-3">
    <svg class="w-5 h-5 text-slate-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
    </svg>
    <div>
      <div class="font-semibold text-slate-800">Important Notice</div>
      <div class="text-sm text-slate-600 mt-1">
        This documentation is for informational purposes only. Please refer to your 
        legal and compliance teams before implementing any features described herein.
      </div>
    </div>
  </div>
</div>
`,

  /**
   * Version notice
   */
  versionNotice: (version: string, date: string) => `
<div class="version-notice flex items-center gap-2 text-sm text-slate-500 mb-6">
  <span class="font-semibold">Version ${version}</span>
  <span>•</span>
  <span>Last updated: ${date}</span>
</div>
`,

  /**
   * Compliance badge
   */
  complianceBadge: (frameworks: string[]) => `
<div class="compliance-badges flex flex-wrap gap-2 my-4">
  ${frameworks.map(f => `
    <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
      ${f} Compliant
    </span>
  `).join('')}
</div>
`,

  /**
   * Security classification
   */
  securityClassification: (level: 'public' | 'internal' | 'confidential' | 'restricted') => {
    const colors = {
      public: 'bg-green-100 text-green-800 border-green-300',
      internal: 'bg-blue-100 text-blue-800 border-blue-300',
      confidential: 'bg-amber-100 text-amber-800 border-amber-300',
      restricted: 'bg-red-100 text-red-800 border-red-300',
    };
    
    return `
<div class="security-classification inline-flex items-center gap-2 px-3 py-1 border rounded-full text-xs font-semibold ${colors[level]}">
  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
  </svg>
  ${level.toUpperCase()}
</div>
`;
  },
};

/**
 * Generate corporate header template
 */
export function generateCorporateHeader(config: {
  companyName: string;
  logoUrl?: string;
  version: string;
}): string {
  return `
<header class="corporate-header border-b bg-white sticky top-0 z-50">
  <div class="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-4">
      ${config.logoUrl ? `<img src="${config.logoUrl}" alt="${config.companyName}" class="h-8" />` : ''}
      <span class="font-semibold text-lg">${config.companyName} Documentation</span>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-sm text-slate-500">v${config.version}</span>
      <button class="px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90">
        Contact Support
      </button>
    </div>
  </div>
</header>
`;
}

/**
 * Generate corporate footer template
 */
export function generateCorporateFooter(config: {
  companyName: string;
  year: number;
  links?: Array<{ label: string; href: string }>;
}): string {
  return `
<footer class="corporate-footer border-t bg-slate-50 py-8">
  <div class="max-w-screen-xl mx-auto px-6">
    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
      <div class="text-sm text-slate-500">
        © ${config.year} ${config.companyName}. All rights reserved.
      </div>
      ${config.links ? `
        <div class="flex items-center gap-6">
          ${config.links.map(link => `
            <a href="${link.href}" class="text-sm text-slate-600 hover:text-primary transition-colors">
              ${link.label}
            </a>
          `).join('')}
        </div>
      ` : ''}
    </div>
  </div>
</footer>
`;
}

export default corporateTheme;
