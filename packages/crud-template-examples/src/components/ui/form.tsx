'use client';

import * as React from 'react';
import { Controller, FormProvider, type Control, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { cn } from '@/lib/utils';

interface FormProps<T extends FieldValues> extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  form: UseFormReturn<T>;
  onSubmit?: (data: T) => void | Promise<void>;
}

function FormInner<T extends FieldValues>({ form, className, children, onSubmit, ...props }: FormProps<T>) {
  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit ? form.handleSubmit(onSubmit) : undefined}
        className={cn(className)}
        {...props}
      >
        {children}
      </form>
    </FormProvider>
  );
}

const Form = Object.assign(FormInner as <T extends FieldValues>(props: FormProps<T>) => React.ReactElement, {
  displayName: 'Form',
});

interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  render: (props: {
    field: { value: unknown; onChange: (value: unknown) => void; onBlur: () => void; ref: React.Ref<unknown> };
    fieldState: { invalid: boolean; error?: { message?: string } };
  }) => React.ReactElement;
}

function FormField<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({
  control,
  name,
  render,
}: FormFieldProps<TFieldValues, TName>) {
  return <Controller control={control} name={name} render={({ field, fieldState }) => render({ field, fieldState })} />;
}

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-2', className)} {...props} />
  )
);
FormItem.displayName = 'FormItem';

const FormLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
      {...props}
    />
  )
);
FormLabel.displayName = 'FormLabel';

const FormControl = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(className)} {...props} />
  )
);
FormControl.displayName = 'FormControl';

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm font-medium text-destructive', className)} {...props}>
      {children}
    </p>
  )
);
FormMessage.displayName = 'FormMessage';

export { Form, FormField, FormItem, FormLabel, FormControl, FormMessage };
