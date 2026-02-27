/**
 * Detail component template
 */

import type { EntityDefinition } from '../types.js';
import { toCamelCase } from '../utils.js';

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
}

export function generateDetailComponent(entity: EntityDefinition): string {
  const entityName = entity.name;
  const entityCamel = toCamelCase(entityName);
  const plural = entity.plural ?? entityCamel + 's';

  const displayFields = entity.fields.filter((f) => f.name !== 'id');
  const detailRows = displayFields
    .map((f) => {
      if (f.type === 'DateTime') {
        return `        <div className="flex py-2 border-b">
          <span className="font-medium w-40">${toTitleCase(f.name)}</span>
          <span>{item.${f.name} ? new Date(item.${f.name} as string | Date).toLocaleString() : '-'}</span>
        </div>`;
      }
      return `        <div className="flex py-2 border-b">
          <span className="font-medium w-40">${toTitleCase(f.name)}</span>
          <span>{String(item.${f.name} ?? '-')}</span>
        </div>`;
    })
    .join('\n');

  return `'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { use${entityName}, useDelete${entityName} } from '@/hooks/use${entityName}';

interface ${entityName}DetailProps {
  id: string;
}

export function ${entityName}Detail({ id }: ${entityName}DetailProps) {
  const router = useRouter();
  const { data: item, isLoading, error } = use${entityName}(id);
  const deleteMutation = useDelete${entityName}();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this ${entityName}?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      router.push('/${plural}');
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-destructive">Error loading ${entityName}</div>;
  if (!item) return <div className="p-4">${entityName} not found</div>;

  return (
    <div className="space-y-4 p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>${entityName} Details</CardTitle>
          <CardDescription>View and manage this ${entityName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
${detailRows}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href={\`/${plural}/\${id}/edit\`}>Edit</Link>
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/${plural}">Back to list</Link>
        </Button>
      </div>
    </div>
  );
}
`;
}
