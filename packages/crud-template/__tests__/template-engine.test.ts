import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../src/template-engine.js';
import type { EntityDefinition } from '../src/types.js';

const POST_ENTITY: EntityDefinition = {
  name: 'Post',
  plural: 'posts',
  fields: [
    { name: 'id', type: 'String', required: true },
    { name: 'title', type: 'String', required: true, searchable: true, sortable: true },
    { name: 'content', type: 'String', required: false, searchable: true },
    { name: 'published', type: 'Boolean', required: true, filterable: true },
    { name: 'createdAt', type: 'DateTime', required: true },
    { name: 'updatedAt', type: 'DateTime', required: true },
  ],
  auth: 'public',
  softDelete: false,
};

describe('TemplateEngine', () => {
  it('generates all CRUD files for an entity', () => {
    const engine = new TemplateEngine({ outputDir: 'src', apiPrefix: 'api' });
    const files = engine.generate(POST_ENTITY);

    const paths = files.map((f) => f.path);
    expect(paths).toContain('src/lib/validators/post.ts');
    expect(paths).toContain('src/lib/services/post.service.ts');
    expect(paths).toContain('src/app/api/posts/route.ts');
    expect(paths).toContain('src/app/api/posts/[id]/route.ts');
    expect(paths).toContain('src/lib/api/post.ts');
    expect(paths).toContain('src/hooks/usePost.ts');
    expect(paths).toContain('src/components/posts/PostList.tsx');
    expect(paths).toContain('src/components/posts/PostForm.tsx');
    expect(paths).toContain('src/components/posts/PostDetail.tsx');
  });

  it('generates validators with create and update schemas', () => {
    const engine = new TemplateEngine();
    const files = engine.generate(POST_ENTITY);
    const validators = files.find((f) => f.path.includes('validators/post'));
    expect(validators).toBeDefined();
    expect(validators!.content).toContain('createPostSchema');
    expect(validators!.content).toContain('updatePostSchema');
    expect(validators!.content).toContain('queryPostSchema');
    expect(validators!.content).toContain('z.string()');
  });

  it('generates service with list, get, create, update, delete', () => {
    const engine = new TemplateEngine();
    const files = engine.generate(POST_ENTITY);
    const service = files.find((f) => f.path.includes('post.service'));
    expect(service).toBeDefined();
    expect(service!.content).toContain('listPosts');
    expect(service!.content).toContain('getPostById');
    expect(service!.content).toContain('createPost');
    expect(service!.content).toContain('updatePost');
    expect(service!.content).toContain('deletePost');
  });

  it('generates Prisma model when includePrismaModel is true', () => {
    const engine = new TemplateEngine({ includePrismaModel: true });
    const files = engine.generate(POST_ENTITY);
    const prisma = files.find((f) => f.path.startsWith('prisma/'));
    expect(prisma).toBeDefined();
    expect(prisma!.content).toContain('model Post');
    expect(prisma!.content).toContain('title');
    expect(prisma!.content).toContain('content');
    expect(prisma!.content).toContain('published');
  });

  it('excludes Prisma model when includePrismaModel is false', () => {
    const engine = new TemplateEngine({ includePrismaModel: false });
    const files = engine.generate(POST_ENTITY);
    const prisma = files.find((f) => f.path.startsWith('prisma/'));
    expect(prisma).toBeUndefined();
  });

  it('generates soft delete for entity with softDelete: true', () => {
    const entity: EntityDefinition = {
      ...POST_ENTITY,
      name: 'Invoice',
      plural: 'invoices',
      softDelete: true,
      fields: [
        ...POST_ENTITY.fields,
        { name: 'deletedAt', type: 'DateTime', required: false },
      ],
    };
    const engine = new TemplateEngine();
    const files = engine.generate(entity);
    const service = files.find((f) => f.path.includes('invoice.service'));
    expect(service!.content).toContain('deletedAt: null');
    expect(service!.content).toContain('deletedAt: new Date()');
  });

  it('generates auth check when auth is authenticated', () => {
    const entity: EntityDefinition = { ...POST_ENTITY, auth: 'authenticated' };
    const engine = new TemplateEngine();
    const files = engine.generate(entity);
    const route = files.find((f) => f.path.includes('api/posts/route'));
    expect(route!.content).toContain('verifyAuth');
  });
});
