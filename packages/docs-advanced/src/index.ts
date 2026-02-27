// ============================================================================
// Advanced Documentation Generator - Public API
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  GeneratorOptions,
  GeneratedDocs,
  GeneratedFile,
  Documentation,
  APIReference,
  Tutorial,
  ExampleDoc,
  ThemeConfig,
  ThemeName,
  OutputFormat,
  VersionComparison,
  NavigationItem,
  SearchIndexEntry,
} from './types';

import {
  generateAPIReference,
  generateAPIReferencePages,
} from './generators/api-reference';

import {
  generateTutorials,
  generateTutorialPages,
} from './generators/tutorials';

import {
  extractExamples,
  generateExamplePages,
  generateSandboxConfig,
} from './generators/examples';

import {
  generateInteractiveComponents,
} from './generators/interactive';

import {
  generateMermaidSequenceDiagram,
  generateMermaidStateDiagram,
  generateMermaidFlowDiagram,
  generateMermaidERDiagram,
  generateMermaidDomainOverview,
} from './generators/diagrams';

import {
  getTheme,
  mergeTheme,
  generateThemeFiles,
} from './themes';

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Generate complete documentation for an ISL domain
 * 
 * @example
 * ```typescript
 * import { generateDocs } from '@isl-lang/docs-advanced';
 * 
 * const docs = await generateDocs(domain, {
 *   format: 'nextra',
 *   outputDir: './docs',
 *   theme: 'default',
 *   interactive: true,
 *   diagrams: true,
 * });
 * 
 * // Write files
 * for (const file of docs.files) {
 *   await fs.writeFile(path.join(outputDir, file.path), file.content);
 * }
 * ```
 */
export async function generateDocs(
  domain: AST.Domain,
  options: GeneratorOptions
): Promise<GeneratedDocs> {
  const files: GeneratedFile[] = [];
  const navigation: NavigationItem[] = [];

  // Get theme configuration
  const theme = options.theme 
    ? mergeTheme(getTheme(options.theme), options.themeConfig ?? {})
    : getTheme('default');

  // Generate API reference
  const apiReference = generateAPIReference(domain);
  const apiPages = generateAPIReferencePages(apiReference, options);
  files.push(...apiPages);
  navigation.push({
    title: 'API Reference',
    path: '/api-reference',
    children: [
      { title: 'Types', path: '/api-reference/types' },
      ...apiReference.entities.map(e => ({
        title: e.name,
        path: `/api-reference/entities/${e.name.toLowerCase()}`,
      })),
      ...apiReference.behaviors.map(b => ({
        title: b.name,
        path: `/api-reference/behaviors/${b.name.toLowerCase()}`,
      })),
    ],
  });

  // Generate tutorials
  const tutorials = generateTutorials(domain, options);
  const tutorialPages = generateTutorialPages(tutorials, options);
  files.push(...tutorialPages);
  navigation.push({
    title: 'Tutorials',
    path: '/tutorials',
    children: tutorials.map(t => ({
      title: t.title,
      path: `/tutorials/${t.id}`,
    })),
  });

  // Generate examples
  const examples = extractExamples(domain);
  const examplePages = generateExamplePages(examples, options);
  files.push(...examplePages);
  navigation.push({
    title: 'Examples',
    path: '/examples',
  });

  // Generate interactive components
  if (options.interactive) {
    const interactiveFiles = generateInteractiveComponents(domain, options);
    files.push(...interactiveFiles);
    navigation.push({
      title: 'Playground',
      path: '/playground',
    });
  }

  // Generate theme files
  const themeFiles = generateThemeFiles(theme);
  files.push(...themeFiles.map(f => ({ ...f, type: 'config' as const })));

  // Generate configuration files
  files.push(...generateConfigFiles(domain, options, navigation));

  // Generate search index
  const searchIndex = generateSearchIndex(files, apiReference, tutorials);

  return {
    files,
    navigation,
    searchIndex,
  };
}

/**
 * Generate documentation for a single behavior
 */
export async function generateBehaviorDocs(
  behavior: AST.Behavior,
  domain: AST.Domain,
  options: Partial<GeneratorOptions>
): Promise<GeneratedFile[]> {
  const fullOptions: GeneratorOptions = {
    format: 'markdown',
    outputDir: './docs',
    ...options,
  };

  const apiRef = generateAPIReference(domain);
  const behaviorDoc = apiRef.behaviors.find(b => b.name === behavior.name.name);
  
  if (!behaviorDoc) {
    throw new Error(`Behavior ${behavior.name.name} not found in domain`);
  }

  const pages = generateAPIReferencePages(
    { ...apiRef, behaviors: [behaviorDoc] },
    fullOptions
  );

  return pages;
}

/**
 * Generate version comparison documentation
 */
export async function generateVersionComparison(
  currentDomain: AST.Domain,
  previousDomain: AST.Domain,
  options: Partial<GeneratorOptions>
): Promise<VersionComparison> {
  const current = generateAPIReference(currentDomain);
  const previous = generateAPIReference(previousDomain);

  const changes: VersionComparison['changes'] = [];

  // Compare entities
  for (const entity of current.entities) {
    const prevEntity = previous.entities.find(e => e.name === entity.name);
    if (!prevEntity) {
      changes.push({
        type: 'added',
        category: 'entity',
        name: entity.name,
        description: `New entity ${entity.name}`,
        breaking: false,
      });
    }
  }

  for (const entity of previous.entities) {
    const currEntity = current.entities.find(e => e.name === entity.name);
    if (!currEntity) {
      changes.push({
        type: 'removed',
        category: 'entity',
        name: entity.name,
        description: `Removed entity ${entity.name}`,
        breaking: true,
      });
    }
  }

  // Compare behaviors
  for (const behavior of current.behaviors) {
    const prevBehavior = previous.behaviors.find(b => b.name === behavior.name);
    if (!prevBehavior) {
      changes.push({
        type: 'added',
        category: 'behavior',
        name: behavior.name,
        description: `New behavior ${behavior.name}`,
        breaking: false,
      });
    } else {
      // Check for breaking changes
      const inputChanged = JSON.stringify(behavior.input) !== JSON.stringify(prevBehavior.input);
      if (inputChanged) {
        changes.push({
          type: 'modified',
          category: 'behavior',
          name: behavior.name,
          description: `Input schema changed for ${behavior.name}`,
          breaking: true,
        });
      }
    }
  }

  for (const behavior of previous.behaviors) {
    const currBehavior = current.behaviors.find(b => b.name === behavior.name);
    if (!currBehavior) {
      changes.push({
        type: 'removed',
        category: 'behavior',
        name: behavior.name,
        description: `Removed behavior ${behavior.name}`,
        breaking: true,
      });
    }
  }

  return {
    currentVersion: current.domain.version,
    previousVersion: previous.domain.version,
    changes,
    summary: {
      added: changes.filter(c => c.type === 'added').length,
      removed: changes.filter(c => c.type === 'removed').length,
      modified: changes.filter(c => c.type === 'modified').length,
      deprecated: changes.filter(c => c.type === 'deprecated').length,
      breaking: changes.filter(c => c.breaking).length,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function generateConfigFiles(
  domain: AST.Domain,
  options: GeneratorOptions,
  navigation: NavigationItem[]
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  if (options.format === 'nextra') {
    // Nextra configuration
    files.push({
      path: 'theme.config.tsx',
      content: generateNextraConfig(domain, options),
      type: 'config',
    });

    // Generate _meta.json files for navigation
    files.push({
      path: '_meta.json',
      content: JSON.stringify(
        Object.fromEntries(navigation.map(n => [
          n.path.replace('/', ''),
          n.title
        ])),
        null,
        2
      ),
      type: 'config',
    });
  }

  if (options.format === 'docusaurus') {
    // Docusaurus configuration
    files.push({
      path: 'docusaurus.config.js',
      content: generateDocusaurusConfig(domain, options),
      type: 'config',
    });

    // Sidebars
    files.push({
      path: 'sidebars.js',
      content: generateDocusaurusSidebars(navigation),
      type: 'config',
    });
  }

  return files;
}

function generateNextraConfig(domain: AST.Domain, options: GeneratorOptions): string {
  return `import { DocsThemeConfig } from 'nextra-theme-docs';

const config: DocsThemeConfig = {
  logo: <span>${domain.name.name} Docs</span>,
  project: {
    link: 'https://github.com/your-org/your-repo',
  },
  docsRepositoryBase: 'https://github.com/your-org/your-repo/tree/main/docs',
  footer: {
    text: '${domain.name.name} Documentation',
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – ${domain.name.name}',
    };
  },
};

export default config;
`;
}

function generateDocusaurusConfig(domain: AST.Domain, options: GeneratorOptions): string {
  return `module.exports = {
  title: '${domain.name.name} Documentation',
  tagline: 'API Documentation',
  url: '${options.baseUrl ?? 'https://docs.example.com'}',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  organizationName: 'your-org',
  projectName: '${domain.name.name.toLowerCase()}-docs',
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/your-org/your-repo/tree/main/docs/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: '${domain.name.name}',
      items: [
        { type: 'doc', docId: 'api-reference/index', position: 'left', label: 'API' },
        { type: 'doc', docId: 'tutorials/index', position: 'left', label: 'Tutorials' },
        { type: 'doc', docId: 'examples/index', position: 'left', label: 'Examples' },
      ],
    },
  },
};
`;
}

function generateDocusaurusSidebars(navigation: NavigationItem[]): string {
  const sidebars: Record<string, unknown[]> = {
    docs: navigation.map(item => ({
      type: 'category',
      label: item.title,
      items: item.children?.map(child => ({
        type: 'doc',
        id: child.path.slice(1).replace(/\//g, '-'),
        label: child.title,
      })) ?? [],
    })),
  };

  return `module.exports = ${JSON.stringify(sidebars, null, 2)};`;
}

function generateSearchIndex(
  files: GeneratedFile[],
  apiRef: APIReference,
  tutorials: Tutorial[]
): SearchIndexEntry[] {
  const index: SearchIndexEntry[] = [];

  // Index API reference
  for (const entity of apiRef.entities) {
    index.push({
      title: entity.name,
      path: `/api-reference/entities/${entity.name.toLowerCase()}`,
      content: entity.description ?? '',
      section: 'Entities',
      keywords: [entity.name, 'entity', ...entity.fields.map(f => f.name)],
    });
  }

  for (const behavior of apiRef.behaviors) {
    index.push({
      title: behavior.name,
      path: `/api-reference/behaviors/${behavior.name.toLowerCase()}`,
      content: behavior.description ?? '',
      section: 'Behaviors',
      keywords: [behavior.name, 'behavior', 'api'],
    });
  }

  // Index tutorials
  for (const tutorial of tutorials) {
    index.push({
      title: tutorial.title,
      path: `/tutorials/${tutorial.id}`,
      content: tutorial.description,
      section: 'Tutorials',
      keywords: [tutorial.title, 'tutorial', tutorial.difficulty],
    });
  }

  return index;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types
export type {
  GeneratorOptions,
  GeneratedDocs,
  GeneratedFile,
  Documentation,
  APIReference,
  Tutorial,
  ExampleDoc,
  ThemeConfig,
  ThemeName,
  OutputFormat,
  VersionComparison,
  NavigationItem,
  SearchIndexEntry,
} from './types';

// Generators
export {
  generateAPIReference,
  generateAPIReferencePages,
} from './generators/api-reference';

export {
  generateTutorials,
  generateTutorialPages,
} from './generators/tutorials';

export {
  extractExamples,
  generateExamplePages,
  generateSandboxConfig,
  generateExampleCode,
} from './generators/examples';

export {
  generateInteractiveComponents,
  generateTryItConfig,
} from './generators/interactive';

export {
  generateMermaidSequenceDiagram,
  generateMermaidStateDiagram,
  generateMermaidFlowDiagram,
  generateMermaidERDiagram,
  generateMermaidDomainOverview,
  mermaidToPlantUML,
} from './generators/diagrams';

// Themes
export {
  getTheme,
  mergeTheme,
  generateThemeFiles,
  defaultTheme,
  corporateTheme,
  themes,
} from './themes';

// Components (for use in docs)
export {
  TryIt,
  CodeSandbox,
  FlowDiagram,
  SequenceDiagram,
  StateDiagram,
  ERDiagram,
} from './components';

// Utilities
export {
  expressionToString,
  typeToString,
  findReferencedTypes,
  findEntityReferences,
} from './utils/ast-helpers';
