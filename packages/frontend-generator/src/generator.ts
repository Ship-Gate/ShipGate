// ============================================================================
// FrontendGenerator — ISL → Next.js + shadcn/ui
// ============================================================================

import type { Domain, Entity, Behavior, ScreenDecl, ComponentDecl } from '@isl-lang/parser';
import type { FrontendGeneratorOptions, GeneratedFrontendFile } from './types.js';
import { mapFieldToMapped } from './component-mapping.js';
import { SHADCN_COMPONENTS, SHADCN_INSTALL_CMD } from './component-mapping.js';
import { toKebab, toPascal, pluralize } from './utils.js';
import { emitLibUtils } from './emitters/lib-utils.js';
import {
  emitSidebar,
  emitHeader,
  emitShell,
  screensToNavItems,
} from './emitters/layout.js';
import { emitZodSchema, emitFormComponent } from './emitters/form.js';
import { emitDataTable } from './emitters/data-table.js';
import { emitApiClient } from './emitters/api-client.js';
import { emitUseEntityList } from './emitters/hooks.js';
import { emitTypes } from './emitters/types.js';
import {
  emitRootLayout,
  emitProviders,
  emitGlobalsCss,
} from './emitters/root-layout.js';

export class FrontendGenerator {
  private options: Required<FrontendGeneratorOptions>;
  private files: GeneratedFrontendFile[] = [];
  private errors: string[] = [];
  private enumNames = new Set<string>();
  private enumValues: Record<string, string[]> = {};

  constructor(options: FrontendGeneratorOptions) {
    this.options = {
      domain: options.domain,
      baseUrl: options.baseUrl ?? '/api',
      outputPrefix: options.outputPrefix ?? 'src',
      appName: options.appName ?? options.domain.name.name,
    };
    this.collectEnums();
  }

  private collectEnums(): void {
    const { domain } = this.options;
    for (const t of domain.types ?? []) {
      const def = t.definition as { kind?: string; variants?: Array<{ name: { name: string } }> };
      if (def?.kind === 'EnumType' && def.variants) {
        this.enumNames.add(t.name.name);
        this.enumValues[t.name.name] = def.variants.map((v) => v.name.name);
      }
    }
  }

  generate(): { files: GeneratedFrontendFile[]; shadcnComponents: string[]; errors: string[] } {
    this.files = [];
    this.errors = [];

    const { domain, outputPrefix } = this.options;
    const prefix = outputPrefix ? `${outputPrefix}/` : '';

    try {
      // 1. lib/utils.ts
      this.files.push({
        path: `${prefix}lib/utils.ts`,
        content: emitLibUtils(),
        type: 'lib',
      });

      // 2. lib/types.ts
      this.files.push({
        path: `${prefix}lib/types.ts`,
        content: emitTypes(
          domain.entities ?? [],
          domain.behaviors ?? [],
          domain.types ?? []
        ),
        type: 'lib',
      });

      // 3. Layout components
      const navItems = screensToNavItems(
        domain.screens ?? [],
        domain.entities ?? []
      );
      this.files.push({
        path: `${prefix}components/layout/Sidebar.tsx`,
        content: emitSidebar(navItems),
        type: 'component',
      });
      this.files.push({
        path: `${prefix}components/layout/Header.tsx`,
        content: emitHeader(this.options.appName),
        type: 'component',
      });
      this.files.push({
        path: `${prefix}components/layout/Shell.tsx`,
        content: emitShell(this.options.appName, navItems),
        type: 'layout',
      });

      // 4. Root layout + providers + globals
      this.files.push({
        path: `${prefix}app/layout.tsx`,
        content: emitRootLayout(this.options.appName),
        type: 'layout',
      });
      this.files.push({
        path: `${prefix}components/providers.tsx`,
        content: emitProviders(),
        type: 'component',
      });
      this.files.push({
        path: `${prefix}app/globals.css`,
        content: emitGlobalsCss(),
        type: 'config',
      });

      // 5. API client (from apis)
      const apis = domain.apis ?? [];
      for (const api of apis) {
        const basePath = api.basePath?.value ?? '';
        const endpoints = api.endpoints ?? [];
        if (endpoints.length > 0) {
          this.files.push({
            path: `${prefix}lib/api-client.ts`,
            content: emitApiClient(basePath, endpoints, this.options.baseUrl),
            type: 'api',
          });
          break; // single api-client for first api block
        }
      }

      // 5b. Entity list hooks
      for (const entity of domain.entities ?? []) {
        const name = entity.name.name;
        this.files.push({
          path: `${prefix}lib/hooks/use-${toKebab(name)}.ts`,
          content: emitUseEntityList(name, this.options.baseUrl),
          type: 'lib',
        });
      }

      // 6. Entity pages: list + form + DataTable
      for (const entity of domain.entities ?? []) {
        const name = entity.name.name;
        const fields = entity.fields.map((f) =>
          mapFieldToMapped(f, this.enumNames, this.enumValues)
        );
        const visibleFields = fields.filter((f) => f.type !== 'file');
        const editableFields = fields.filter(
          (f) =>
            !['file'].includes(f.type) &&
            !entity.fields.find(
              (ef) =>
                ef.name.name === f.name &&
                (ef.annotations ?? []).some(
                  (a) =>
                    a.name.name.toLowerCase() === 'immutable' ||
                    a.name.name.toLowerCase() === 'secret'
                )
            )
        );

        // DataTable component
        this.files.push({
          path: `${prefix}components/${name}DataTable.tsx`,
          content: emitDataTable(name, visibleFields, pluralize(name)),
          type: 'component',
        });

        // Form + schema if editable
        if (editableFields.length > 0) {
          const schemaName = `${name}Form`;
          this.files.push({
            path: `${prefix}lib/schemas/${toKebab(name)}-form.ts`,
            content: emitZodSchema(editableFields, schemaName),
            type: 'lib',
          });
          this.files.push({
            path: `${prefix}components/${name}Form.tsx`,
            content: emitFormComponent(
              `${name}Form`,
              editableFields,
              schemaName,
              'Submit',
              `@/lib/schemas/${toKebab(name)}-form`,
              undefined
            ),
            type: 'component',
          });
        }

        // Page: list + create link
        const kebab = toKebab(name);
        this.files.push({
          path: `${prefix}app/${kebab}/page.tsx`,
          content: this.emitEntityListPage(name, pluralize(name), kebab),
          type: 'page',
        });
      }

      // 7. Screen-based pages (override if screens exist)
      for (const screen of domain.screens ?? []) {
        const route = screen.route?.value ?? `/${toKebab(screen.name.name)}`;
        const path = route.replace(/^\//, '').replace(/\/$/, '') || 'page';
        const pagePath = path === 'page' ? 'page' : `${path}/page`;
        this.files.push({
          path: `${prefix}app/${pagePath}.tsx`,
          content: this.emitScreenPage(screen),
          type: 'page',
        });
      }

      // 8. Home page if no screens
      if (!domain.screens?.length) {
        this.files.push({
          path: `${prefix}app/page.tsx`,
          content: this.emitHomePage(),
          type: 'page',
        });
      }
    } catch (err) {
      this.errors.push(err instanceof Error ? err.message : String(err));
    }

    return {
      files: this.files,
      shadcnComponents: [...SHADCN_COMPONENTS],
      errors: this.errors,
    };
  }

  private emitEntityListPage(
    entityName: string,
    pluralName: string,
    kebab: string
  ): string {
    return `"use client";

import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { ${entityName}DataTable } from "@/components/${entityName}DataTable";
import { Button } from "@/components/ui/button";
import { use${entityName}List } from "@/lib/hooks/use-${kebab}";

export default function ${pluralName}Page() {
  const { data, isLoading, error } = use${entityName}List();

  return (
    <Shell breadcrumbs={[{ label: "${pluralName}" }]}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">${pluralName}</h1>
          <Button asChild>
            <Link href="/${kebab}/new">Create New</Link>
          </Button>
        </div>
        <${entityName}DataTable
          data={data}
          isLoading={isLoading}
          error={error}
          onView={(item) => {
            const id = (item as { id?: string }).id;
            if (id) window.location.href = \`/${kebab}/\${id}\`;
          }}
        />
      </div>
    </Shell>
  );
}
`;
  }

  private emitScreenPage(screen: ScreenDecl): string {
    const name = screen.name.name;
    const { components: comps, imports, hookDecl } = this.emitScreenComponents(screen.components ?? []);

    return `"use client";

import { Shell } from "@/components/layout/Shell";
${imports}

export default function ${toPascal(name)}Page() {
${hookDecl}
  return (
    <Shell breadcrumbs={[{ label: "${name}" }]}>
      <div className="space-y-6">
        ${comps || '<p>No components defined.</p>'}
      </div>
    </Shell>
  );
}
`;
  }

  private emitScreenComponents(
    components: ComponentDecl[]
  ): { components: string; imports: string; hookDecl: string } {
    const imports = new Set<string>();
    const parts: string[] = [];
    let listEntity: string | null = null;

    for (const comp of components) {
      if (comp.type === 'form' && comp.entity) {
        const entityName = comp.entity.name;
        imports.add(`import { ${entityName}Form } from "@/components/${entityName}Form";`);
        parts.push(`<${entityName}Form onSubmit={async () => { /* TODO: call API */ }} />`);
      } else if (comp.type === 'list' && comp.entity) {
        const entityName = comp.entity.name;
        listEntity = entityName;
        imports.add(`import { ${entityName}DataTable } from "@/components/${entityName}DataTable";`);
        imports.add(`import { use${entityName}List } from "@/lib/hooks/use-${toKebab(entityName)}";`);
        parts.push(`<${entityName}DataTable data={data} isLoading={isLoading} error={error} />`);
      }
    }

    const hookDecl = listEntity
      ? `  const { data, isLoading, error } = use${listEntity}List();\n`
      : '';

    return {
      components: parts.join('\n        '),
      imports: [...imports].join('\n'),
      hookDecl,
    };
  }

  private emitHomePage(): string {
    const { domain } = this.options;
    const links = (domain.entities ?? []).map(
      (e) =>
        `        <Link href="/${toKebab(e.name.name)}" className="text-primary hover:underline">
          ${pluralize(e.name.name)}
        </Link>`
    ).join('\n');

    return `"use client";

import Link from "next/link";
import { Shell } from "@/components/layout/Shell";

export default function HomePage() {
  return (
    <Shell>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">${this.options.appName}</h1>
        <nav className="flex flex-col gap-2">
${links || '          <p className="text-muted-foreground">No entities defined.</p>'}
        </nav>
      </div>
    </Shell>
  );
}
`;
  }

  /** Get shadcn CLI install command */
  static getShadcnInstallCommand(): string {
    return SHADCN_INSTALL_CMD;
  }
}
