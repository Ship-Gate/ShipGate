'use client';

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
import { usePostList } from '@/hooks/usePost';

function toTitleCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
}

export function PostList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, error } = usePostList({
    page,
    limit: 20,
    search: search || undefined,
    sortBy,
    sortOrder,
  });

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-destructive">Error loading posts</div>;

  const result = data ?? { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Posts</h1>
        <Button asChild>
          <Link href="/posts/create">Create Post</Link>
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem key="title" value="title">Title</SelectItem>
            <SelectItem key="published" value="published">Published</SelectItem>
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
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
        <TableHead key="id">Id</TableHead>
        <TableHead key="title">Title</TableHead>
        <TableHead key="content">Content</TableHead>
        <TableHead key="published">Published</TableHead>
        <TableHead key="createdAt">Created At</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((item) => (
              <TableRow key={item.id}>
            <TableCell>{String(item.id ?? '-')}</TableCell>
            <TableCell>{String(item.title ?? '-')}</TableCell>
            <TableCell>{String(item.content ?? '-')}</TableCell>
            <TableCell>{String(item.published ?? '-')}</TableCell>
            <TableCell>{item.createdAt ? new Date(item.createdAt as string | Date).toLocaleString() : '-'}</TableCell>
                <TableCell>
                  <Button variant="link" size="sm" asChild>
                    <Link href={`/posts/${item.id}`}>View</Link>
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
