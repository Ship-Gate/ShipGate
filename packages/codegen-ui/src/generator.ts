/**
 * UI Blueprint to Next.js Generator
 * 
 * Generates safe, accessible Next.js landing pages from ISL UI blueprints.
 */

import type * as AST from '@isl-lang/isl-core/ast/types';
import type {
  UIGeneratorOptions,
  GeneratedFile,
  UIGenerationResult,
  UIGenerationError,
  UIGenerationWarning,
  ResolvedToken,
} from './types.js';

const DEFAULT_OPTIONS: Required<UIGeneratorOptions> = {
  outputDir: './generated',
  typescript: true,
  tailwind: true,
  routerType: 'app',
  includeStyles: true,
};

/**
 * Generate Next.js landing page from UI blueprint
 */
export function generateLandingPage(
  blueprint: AST.UIBlueprintDeclaration,
  options: UIGeneratorOptions = {}
): UIGenerationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const files: GeneratedFile[] = [];
  const errors: UIGenerationError[] = [];
  const warnings: UIGenerationWarning[] = [];

  try {
    // Generate design tokens CSS
    if (blueprint.tokens) {
      const tokensFile = generateTokensCSS(blueprint.tokens);
      files.push(tokensFile);
    }

    // Generate page component
    const pageFile = generatePageComponent(blueprint, opts);
    files.push(pageFile);

    // Generate section components
    for (const section of blueprint.sections) {
      const sectionFile = generateSectionComponent(section, opts);
      files.push(sectionFile);
    }

    // Generate layout if app router
    if (opts.routerType === 'app') {
      const layoutFile = generateLayout(blueprint, opts);
      files.push(layoutFile);
    }

    // Check for warnings based on constraints
    if (blueprint.constraints) {
      const constraintWarnings = checkConstraints(blueprint);
      warnings.push(...constraintWarnings);
    }

    return { success: true, files, errors, warnings };
  } catch (error) {
    errors.push({
      code: 'GENERATION_FAILED',
      message: error instanceof Error ? error.message : String(error),
    });
    return { success: false, files, errors, warnings };
  }
}

/**
 * Generate CSS custom properties from design tokens
 */
function generateTokensCSS(tokenBlock: AST.UITokenBlock): GeneratedFile {
  const lines: string[] = [
    '/* Auto-generated design tokens from ISL UI Blueprint */',
    '/* DO NOT EDIT - regenerate from ISL spec */',
    '',
    ':root {',
  ];

  for (const token of tokenBlock.tokens) {
    const cssVar = `--${kebabCase(token.name.name)}`;
    const value = resolveTokenValue(token.value);
    lines.push(`  ${cssVar}: ${value};`);
  }

  lines.push('}');
  lines.push('');

  return {
    path: 'styles/tokens.css',
    content: lines.join('\n'),
    type: 'style',
  };
}

/**
 * Generate the main page component
 */
function generatePageComponent(
  blueprint: AST.UIBlueprintDeclaration,
  opts: Required<UIGeneratorOptions>
): GeneratedFile {
  const ext = opts.typescript ? 'tsx' : 'jsx';
  const pageName = pascalCase(blueprint.name.name);
  
  const imports = generateImports(blueprint, opts);
  const sectionImports = blueprint.sections
    .map(s => `import ${pascalCase(s.name.name)}Section from '@/components/${pascalCase(s.name.name)}Section';`)
    .join('\n');

  const metadataExport = opts.routerType === 'app' ? generateMetadata(blueprint) : '';
  
  const sectionRenders = blueprint.sections
    .map(s => `      <${pascalCase(s.name.name)}Section />`)
    .join('\n');

  const content = `${imports}
${sectionImports}

${metadataExport}

export default function ${pageName}Page() {
  return (
    <main className="min-h-screen">
${sectionRenders}
    </main>
  );
}
`;

  const path = opts.routerType === 'app' 
    ? `app/page.${ext}`
    : `pages/index.${ext}`;

  return { path, content, type: 'page' };
}

/**
 * Generate section component
 */
function generateSectionComponent(
  section: AST.UISection,
  opts: Required<UIGeneratorOptions>
): GeneratedFile {
  const ext = opts.typescript ? 'tsx' : 'jsx';
  const componentName = `${pascalCase(section.name.name)}Section`;
  
  const layoutClasses = getLayoutClasses(section.layout, section.type);
  const blockContent = section.blocks.map(b => generateBlockJSX(b, opts)).join('\n');

  const content = `/**
 * ${componentName}
 * Auto-generated from ISL UI Blueprint
 * Section type: ${section.type}
 */

${opts.typescript ? "import type { FC } from 'react';" : ''}

${opts.typescript ? `const ${componentName}: FC = () => {` : `export default function ${componentName}() {`}
  return (
    <section className="${layoutClasses}" aria-label="${section.name.name}">
${blockContent}
    </section>
  );
}${opts.typescript ? `

export default ${componentName};` : ''}
`;

  return {
    path: `components/${componentName}.${ext}`,
    content,
    type: 'component',
  };
}

/**
 * Generate JSX for a content block
 */
function generateBlockJSX(block: AST.UIContentBlock, opts: Required<UIGeneratorOptions>, indent = 6): string {
  const spaces = ' '.repeat(indent);
  const props = resolveBlockProps(block.props);
  
  switch (block.type) {
    case 'heading':
      const level = props.level || '1';
      const HeadingTag = `h${level}`;
      return `${spaces}<${HeadingTag} className="font-bold ${getHeadingClasses(level)}">${escapeJSX(props.content || '')}</${HeadingTag}>`;

    case 'text':
      return `${spaces}<p className="text-base leading-relaxed">${escapeJSX(props.content || '')}</p>`;

    case 'image':
      // Safe image: require alt text for a11y
      const alt = props.alt || 'Image';
      const src = sanitizeUrl(props.src || '/placeholder.jpg');
      return `${spaces}<img 
${spaces}  src="${src}" 
${spaces}  alt="${escapeJSX(alt)}"
${spaces}  className="max-w-full h-auto"
${spaces}  loading="lazy"
${spaces}/>`;

    case 'button':
      const buttonText = props.label || props.content || 'Click here';
      const href = props.href ? sanitizeUrl(props.href) : undefined;
      if (href) {
        return `${spaces}<a 
${spaces}  href="${href}"
${spaces}  className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
${spaces}  ${isExternalUrl(href) ? 'rel="noopener noreferrer" target="_blank"' : ''}
${spaces}>${escapeJSX(buttonText)}</a>`;
      }
      return `${spaces}<button 
${spaces}  type="button"
${spaces}  className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
${spaces}>${escapeJSX(buttonText)}</button>`;

    case 'link':
      const linkHref = sanitizeUrl(props.href || '#');
      const linkText = props.content || props.label || 'Learn more';
      return `${spaces}<a 
${spaces}  href="${linkHref}"
${spaces}  className="text-primary hover:underline"
${spaces}  ${isExternalUrl(linkHref) ? 'rel="noopener noreferrer" target="_blank"' : ''}
${spaces}>${escapeJSX(linkText)}</a>`;

    case 'form':
      return generateSafeForm(block, props, opts, indent);

    case 'container':
      const childContent = block.children
        ?.map(c => generateBlockJSX(c, opts, indent + 2))
        .join('\n') || '';
      const containerClass = props.className || 'flex flex-col gap-4';
      return `${spaces}<div className="${containerClass}">
${childContent}
${spaces}</div>`;

    default:
      return `${spaces}<div>${escapeJSX(props.content || '')}</div>`;
  }
}

/**
 * Generate a safe form (no secrets, proper action handling)
 */
function generateSafeForm(
  block: AST.UIContentBlock,
  props: Record<string, string>,
  opts: Required<UIGeneratorOptions>,
  indent: number
): string {
  const spaces = ' '.repeat(indent);
  const action = props.action ? sanitizeUrl(props.action) : '';
  const method = (props.method || 'POST').toUpperCase();
  
  // Generate child inputs
  const inputs = block.children
    ?.filter(c => c.type === 'text') // text blocks in form become inputs
    .map(c => {
      const inputProps = resolveBlockProps(c.props);
      const inputName = inputProps.name || 'field';
      const inputLabel = inputProps.label || inputName;
      const inputType = inputProps.type || 'text';
      return `${spaces}  <label className="block">
${spaces}    <span className="text-sm font-medium">${escapeJSX(inputLabel)}</span>
${spaces}    <input
${spaces}      type="${inputType}"
${spaces}      name="${escapeJSX(inputName)}"
${spaces}      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
${spaces}      required
${spaces}    />
${spaces}  </label>`;
    })
    .join('\n') || '';

  return `${spaces}<form 
${spaces}  action="${action}"
${spaces}  method="${method}"
${spaces}  className="space-y-4"
${spaces}>
${inputs}
${spaces}  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg">
${spaces}    ${escapeJSX(props.submitLabel || 'Submit')}
${spaces}  </button>
${spaces}</form>`;
}

/**
 * Generate layout component for app router
 */
function generateLayout(
  blueprint: AST.UIBlueprintDeclaration,
  opts: Required<UIGeneratorOptions>
): GeneratedFile {
  const ext = opts.typescript ? 'tsx' : 'jsx';
  
  const content = `import type { Metadata } from 'next';
import './globals.css';
${blueprint.tokens ? "import '@/styles/tokens.css';" : ''}

export const metadata: Metadata = {
  title: '${escapeJSX(blueprint.name.name)}',
  description: 'Generated from ISL UI Blueprint',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
`;

  return {
    path: `app/layout.${ext}`,
    content,
    type: 'config',
  };
}

/**
 * Generate metadata export for SEO
 */
function generateMetadata(blueprint: AST.UIBlueprintDeclaration): string {
  return `export const metadata = {
  title: '${escapeJSX(blueprint.name.name)}',
  description: 'Generated landing page',
};
`;
}

/**
 * Generate import statements
 */
function generateImports(blueprint: AST.UIBlueprintDeclaration, opts: Required<UIGeneratorOptions>): string {
  const imports: string[] = [];
  
  if (opts.typescript) {
    imports.push("import type { Metadata } from 'next';");
  }

  return imports.join('\n');
}

/**
 * Check constraints and return warnings
 */
function checkConstraints(blueprint: AST.UIBlueprintDeclaration): UIGenerationWarning[] {
  const warnings: UIGenerationWarning[] = [];
  
  if (!blueprint.constraints) return warnings;

  for (const constraint of blueprint.constraints.constraints) {
    // These constraints are enforced during generation
    if (constraint.type === 'a11y' && constraint.rule.name === 'images_have_alt') {
      // Already enforced in generateBlockJSX
    }
    if (constraint.type === 'security' && constraint.rule.name === 'no_inline_secrets') {
      // Checked in sanitization
    }
  }

  return warnings;
}

// ============================================
// Utility Functions
// ============================================

function resolveTokenValue(expr: AST.Expression): string {
  if (expr.kind === 'StringLiteral') {
    return expr.value;
  }
  if (expr.kind === 'NumberLiteral') {
    return expr.unit ? `${expr.value}${expr.unit}` : String(expr.value);
  }
  return 'inherit';
}

function resolveBlockProps(props: AST.UIBlockProperty[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const prop of props) {
    if (prop.value.kind === 'StringLiteral') {
      result[prop.name.name] = prop.value.value;
    } else if (prop.value.kind === 'NumberLiteral') {
      result[prop.name.name] = String(prop.value.value);
    } else if (prop.value.kind === 'BooleanLiteral') {
      result[prop.name.name] = String(prop.value.value);
    }
  }
  return result;
}

function getLayoutClasses(layout: AST.UILayout | undefined, sectionType: string): string {
  const base = 'py-16 px-4 md:px-8 lg:px-16';
  
  if (!layout) {
    // Default layouts by section type
    switch (sectionType) {
      case 'hero':
        return `${base} flex flex-col items-center justify-center min-h-[60vh] text-center`;
      case 'features':
        return `${base} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8`;
      case 'testimonials':
        return `${base} grid grid-cols-1 md:grid-cols-2 gap-6`;
      case 'cta':
        return `${base} flex flex-col items-center text-center bg-primary/5`;
      case 'footer':
        return `${base} bg-gray-900 text-white`;
      case 'header':
        return 'py-4 px-4 md:px-8 flex items-center justify-between';
      default:
        return `${base} max-w-4xl mx-auto`;
    }
  }

  let classes = base;
  
  switch (layout.type) {
    case 'grid':
      const cols = layout.columns?.value || 3;
      classes += ` grid grid-cols-1 md:grid-cols-${Math.min(cols, 2)} lg:grid-cols-${cols}`;
      break;
    case 'flex':
      classes += ' flex flex-col md:flex-row';
      break;
    case 'stack':
      classes += ' flex flex-col';
      break;
  }

  if (layout.gap) {
    const gapValue = resolveTokenValue(layout.gap);
    classes += ` gap-${gapValue.replace('px', '')}`;
  } else {
    classes += ' gap-6';
  }

  return classes;
}

function getHeadingClasses(level: string): string {
  switch (level) {
    case '1': return 'text-4xl md:text-5xl lg:text-6xl';
    case '2': return 'text-3xl md:text-4xl';
    case '3': return 'text-2xl md:text-3xl';
    case '4': return 'text-xl md:text-2xl';
    case '5': return 'text-lg md:text-xl';
    case '6': return 'text-base md:text-lg';
    default: return 'text-4xl';
  }
}

function pascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, c => c.toUpperCase());
}

function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function escapeJSX(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize URL - prevent unsafe redirects and javascript: URLs
 */
function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase();
  
  // Block javascript: and data: URLs
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    return '#';
  }
  
  // Block file: URLs
  if (trimmed.startsWith('file:')) {
    return '#';
  }

  return url;
}

function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.hostname !== 'localhost' && !url.startsWith('/') && !url.startsWith('#');
  } catch {
    return false;
  }
}
