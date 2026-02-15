/**
 * List component template (shadcn Table)
 */

import type { EntityDefinition } from '../types.js';
import { toCamelCase } from '../utils.js';

export function generateListComponent(entity: EntityDefinition): string {
  const entityName = entity.name;
  const entityCamel = toCamelCase(entityName);
  const plural = entity.plural ?? entityCamel + 's';
  let listFields = entity.listFields ?? entity.fields.filter((f) => f.listDisplay !== false).slice(0, 5).map((f) => f.name);
  if (listFields.length === 0) listFields = ['id'];
  const hasSearch = entity.fields.some((f) => f.searchable);
  const sortableFields = entity.fields.filter((f) => f.sortable).map((f) => f.name);
  if (sortableFields.length === 0) sortableFields.push('id');

  const fieldMap = new Map(entity.fields.map((f) => [f.name, f]));
  const thCells = listFields.map((f) => `        <TableHead key="${f}">${toTitleCase(f)}</TableHead>`).join('\n');
  const tdCells = listFields
    .map((f) => {
      const field = fieldMap.get(f);
      if (field?.type === 'DateTime') {
        return `            <TableCell>{item.${f} ? new Date(item.${f} as string | Date).toLocaleString() : '-'}</TableCell>`;
      }
      return `            <TableCell>{String(item.${f} ?? '-')}</TableCell>`;
    })
    .join('\n');

  return `'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { use${entityName}List } from '@/hooks/use${entityName}';

function toTitleCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
}

export function ${entityName}List() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('${sortableFields[0]}');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, error } = use${entityName}List({
    page,
    limit: 20,
    ${hasSearch ? 'search: search || undefined,' : ''}
    sortBy,
    sortOrder,
  });

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-destructive">Error loading ${plural}</div>;

  const result = data ?? { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">${toTitleCase(plural)}</h1>
        <Button asChild>
          <Link href="/${plural}/create">Create ${entityName}</Link>
        </Button>
      </div>
      ${hasSearch || sortableFields.length > 0 ? `
      <div className="flex gap-2">
        ${hasSearch ? `<Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />` : ''}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            ${sortableFields.map((f) => `<SelectItem key="${f}" value="${f}">${toTitleCase(f)}</SelectItem>`).join('\n            ')}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </Button>
      </div>
      ` : ''}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
${thCells}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((item) => (
              <TableRow key={item.id}>
${tdCells}
                <TableCell>
                  <Button variant="link" size="sm" asChild>
                    <Link href={\`/${plural}/\${item.id}\`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {result.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="py-2">
            Page {page} of {result.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= result.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
`;
}

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
}
