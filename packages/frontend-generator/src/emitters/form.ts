// ============================================================================
// Form Emitter — shadcn Form + react-hook-form + Zod
// ============================================================================

import type { MappedField } from '../types.js';
import { toCamel, toPascal } from '../utils.js';

export function emitZodSchema(fields: MappedField[], schemaName: string): string {
  const schemaFields = fields
    .map((f) => {
      let z = 'z.string()';
      if (f.type === 'number') z = 'z.coerce.number()';
      else if (f.type === 'boolean') z = 'z.boolean()';
      else if (f.type === 'email') z = 'z.string().email()';
      else if (f.type === 'date') z = 'z.string()';
      else if (f.type === 'select' && f.enumValues?.length) {
        z = `z.enum([${f.enumValues.map((v) => `"${v}"`).join(', ')}])`;
      } else if (f.type === 'file') z = 'z.instanceof(File).optional()';
      if (f.optional) z += '.optional()';
      else z += '.min(1, "Required")';
      return `  ${f.name}: ${z}`;
    })
    .join(',\n');

  return `import { z } from "zod";

export const ${schemaName}Schema = z.object({
${schemaFields}
});

export type ${schemaName} = z.infer<typeof ${schemaName}Schema>;
`;
}

export function emitFormComponent(
  componentName: string,
  fields: MappedField[],
  schemaName: string,
  submitLabel: string,
  schemaPath: string,
  _behaviorName?: string
): string {
  const formFields = fields.map((f) => emitFormField(f)).join('\n\n');

  return `"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ${schemaName}Schema, type ${schemaName} } from "${schemaPath}";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ${componentName}Props {
  initialValues?: Partial<${schemaName}>;
  onSubmit: (values: ${schemaName}) => void | Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function ${componentName}({
  initialValues,
  onSubmit,
  loading = false,
  submitLabel = "${submitLabel}",
}: ${componentName}Props) {
  const form = useForm<${schemaName}>({
    resolver: zodResolver(${schemaName}Schema),
    defaultValues: initialValues ?? {},
  });

  async function handleSubmit(values: ${schemaName}) {
    await onSubmit(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
${formFields}
        <Button type="submit" disabled={loading}>
          {loading ? "Submitting…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
`;
}

function emitFormField(field: MappedField): string {
  const name = field.name;
  const label = field.label;

  switch (field.type) {
    case 'boolean':
      return `        <FormField
          control={form.control}
          name="${name}"
          render={({ field: f }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Switch checked={f.value} onCheckedChange={f.onChange} />
              </FormControl>
              <FormLabel className="!mt-0">${label}</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />`;
    case 'select':
      const options =
        field.enumValues?.map((v) => `              <SelectItem key="${v}" value="${v}">${v}</SelectItem>`).join('\n') ??
        '';
      return `        <FormField
          control={form.control}
          name="${name}"
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>${label}</FormLabel>
              <Select onValueChange={f.onChange} value={f.value ?? ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
${options || '                <SelectItem value=" ">—</SelectItem>'}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />`;
    case 'textarea':
      return `        <FormField
          control={form.control}
          name="${name}"
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>${label}</FormLabel>
              <FormControl>
                <Textarea {...f} placeholder="${label}" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />`;
    case 'file':
      return `        <FormField
          control={form.control}
          name="${name}"
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>${label}</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-4">
                  <Input
                    type="file"
                    onChange={(e) => f.onChange(e.target.files?.[0])}
                    className="cursor-pointer"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />`;
    default: {
      const inputType =
        field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text';
      return `        <FormField
          control={form.control}
          name="${name}"
          render={({ field: f }) => (
            <FormItem>
              <FormLabel>${label}</FormLabel>
              <FormControl>
                <Input type="${inputType}" placeholder="${label}" {...f} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />`;
    }
  }
}
