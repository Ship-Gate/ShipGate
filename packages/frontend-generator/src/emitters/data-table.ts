// ============================================================================
// DataTable Emitter — Entity list with shadcn Table
// ============================================================================

import type { MappedField } from '../types.js';
import { toKebab, toPascal } from '../utils.js';

export function emitDataTable(
  entityName: string,
  fields: MappedField[],
  pluralName: string
): string {
  const columns = fields
    .filter((f) => f.type !== 'file')
    .map(
      (f) => `    {
      accessorKey: "${f.name}",
      header: "${f.label}",
    }`
    )
    .join(',\n');

  return `"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ${entityName} } from "@/lib/types";

export interface ${entityName}DataTableProps {
  data: ${entityName}[] | undefined;
  isLoading?: boolean;
  error?: Error | null;
  onView?: (item: ${entityName}) => void;
  onDelete?: (item: ${entityName}) => void;
}

export function ${entityName}DataTable({
  data,
  isLoading = false,
  error = null,
  onView,
  onDelete,
}: ${entityName}DataTableProps) {
  const router = useRouter();

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No ${pluralName.toLowerCase()} found.
      </div>
    );
  }

  const columns = [
${columns}
  ];

  function getCellValue(item: ${entityName}, key: string) {
    const val = (item as Record<string, unknown>)[key];
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    return String(val);
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.accessorKey}>{col.header}</TableHead>
            ))}
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, idx) => (
            <TableRow key={(item as { id?: string }).id ?? idx}>
              {columns.map((col) => (
                <TableCell key={col.accessorKey}>
                  {getCellValue(item, col.accessorKey)}
                </TableCell>
              ))}
              <TableCell>
                <div className="flex gap-2">
                  {onView && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onView(item)}
                    >
                      View
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(item)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
`;
}
