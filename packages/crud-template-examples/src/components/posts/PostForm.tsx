'use client';

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
import { createPostSchema, updatePostSchema, type CreatePostInput } from '@/lib/validators/post';
import { useCreatePost, useUpdatePost } from '@/hooks/usePost';
import type { Post } from '@/lib/api/post';

type PostFormValues = CreatePostInput;

interface PostFormProps {
  post?: Post | null;
  mode: 'create' | 'edit';
}

export function PostForm({ post, mode }: PostFormProps) {
  const router = useRouter();
  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();

  const form = useForm<PostFormValues>({
    resolver: zodResolver(mode === 'create' ? createPostSchema : updatePostSchema),
    defaultValues: post ? {
      title: post?.title ?? '',
      content: post?.content ?? '',
      published: post?.published ?? false
    } : { title: '', content: '', published: false },
  });

  const onSubmit = async (data: PostFormValues) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(data as CreatePostInput);
        router.push('/posts');
      } else if (post) {
        await updateMutation.mutateAsync({ id: post.id, data });
        router.push(`/posts/${post.id}`);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form form={form} onSubmit={onSubmit} className="space-y-6 max-w-md">
        <FormField
          control={form.control}
          name="title"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input value={String(f.value ?? '')} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field: f, fieldState }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Input value={String(f.value ?? '')} onChange={f.onChange} onBlur={f.onBlur} />
              </FormControl>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="published"
          render={({ field: f, fieldState }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Checkbox checked={!!f.value} onCheckedChange={f.onChange} />
              </FormControl>
              <FormLabel>Published</FormLabel>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
        </Button>
    </Form>
  );
}
