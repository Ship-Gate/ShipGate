/**
 * Form component template (shadcn Form + react-hook-form + zod)
 */

import type { EntityDefinition, EntityField } from '../types.js';
import { toCamelCase } from '../utils.js';

function fieldToFormControl(field: EntityField): string {
  switch (field.type) {
    case 'Boolean':
      return `<FormField
          control={form.control}
          name="${field.name}"
          render={({ field: f, fieldState }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Checkbox checked={!!f.value} onCheckedChange={f.onChange} />
              </FormControl>
              <FormLabel>${toTitleCase(field.name)}</FormLabel>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />`;
    case 'Int':
    case 'Float':
    case 'Decimal':
      return `<FormField
          control={form.control}
          name="${field.name}"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>${toTitleCase(field.name)}</FormLabel>
              <FormControl>
                <Input type="number" value={typeof f.value === 'number' ? f.value : f.value === undefined || f.value === null ? '' : Number(f.value)} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />`;
    case 'DateTime':
      return `<FormField
          control={form.control}
          name="${field.name}"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>${toTitleCase(field.name)}</FormLabel>
              <FormControl>
                <Input
                  type="datetime-local"
                  value={f.value ? new Date(f.value as string | Date).toISOString().slice(0, 16) : ''}
                  onChange={(e) => f.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                  onBlur={f.onBlur}
                />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />`;
    default:
      return `<FormField
          control={form.control}
          name="${field.name}"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>${toTitleCase(field.name)}</FormLabel>
              <FormControl>
                <Input value={String(f.value ?? '')} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />`;
  }
}

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
}

export function generateFormComponent(entity: EntityDefinition): string {
  const entityName = entity.name;
  const entityCamel = toCamelCase(entityName);
  const plural = entity.plural ?? entityCamel + 's';

  const formFields = entity.fields.filter(
    (f) =>
      f.name !== 'id' &&
      f.name !== 'createdAt' &&
      f.name !== 'updatedAt' &&
      (entity.softDelete ? f.name !== 'deletedAt' : true) &&
      f.editable !== false
  );

  const formItems = formFields.map((f) => fieldToFormControl(f)).join('\n        ');

  const defaultValues = formFields
    .map((f) => {
      if (f.default !== undefined) return `${f.name}: ${JSON.stringify(f.default)}`;
      if (f.type === 'Boolean') return `${f.name}: false`;
      if (f.type === 'Int' || f.type === 'Float' || f.type === 'Decimal') return `${f.name}: 0`;
      return `${f.name}: ''`;
    })
    .join(', ');

  const editDefaults = formFields
    .map((f) => {
      if (f.type === 'DateTime') return `${f.name}: ${entityCamel}?.${f.name} ? new Date(${entityCamel}.${f.name}).toISOString().slice(0, 16) : ''`;
      if (f.type === 'Boolean') return `${f.name}: ${entityCamel}?.${f.name} ?? false`;
      if (f.type === 'Int' || f.type === 'Float' || f.type === 'Decimal') return `${f.name}: ${entityCamel}?.${f.name} ?? 0`;
      return `${f.name}: ${entityCamel}?.${f.name} ?? ''`;
    })
    .join(',\n      ');

  return `'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { create${entityName}Schema, update${entityName}Schema, type Create${entityName}Input } from '@/lib/validators/${entityCamel}';
import { useCreate${entityName}, useUpdate${entityName} } from '@/hooks/use${entityName}';
import type { ${entityName} } from '@/lib/api/${entityCamel}';

type ${entityName}FormValues = Create${entityName}Input;

interface ${entityName}FormProps {
  ${entityCamel}?: ${entityName} | null;
  mode: 'create' | 'edit';
}

export function ${entityName}Form({ ${entityCamel}, mode }: ${entityName}FormProps) {
  const router = useRouter();
  const createMutation = useCreate${entityName}();
  const updateMutation = useUpdate${entityName}();

  const form = useForm<${entityName}FormValues>({
    resolver: zodResolver(mode === 'create' ? create${entityName}Schema : update${entityName}Schema),
    defaultValues: ${entityCamel} ? {
      ${editDefaults}
    } : { ${defaultValues} },
  });

  const onSubmit = async (data: ${entityName}FormValues) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(data as Create${entityName}Input);
        router.push('/${plural}');
      } else if (${entityCamel}) {
        await updateMutation.mutateAsync({ id: ${entityCamel}.id, data });
        router.push(\`/${plural}/\${${entityCamel}.id}\`);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form form={form} onSubmit={onSubmit} className="space-y-6 max-w-md">
        ${formItems}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
        </Button>
    </Form>
  );
}
`;
}
