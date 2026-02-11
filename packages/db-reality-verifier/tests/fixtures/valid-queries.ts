// Valid Prisma queries
// Note: These are mock imports for testing query extraction
const prisma = {
  user: {
    findMany: () => Promise.resolve([]),
    findUnique: () => Promise.resolve(null),
  },
  post: {
    create: () => Promise.resolve({}),
    findMany: () => Promise.resolve([]),
  },
};

export async function getUsers() {
  return prisma.user.findMany();
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
}

export async function createPost(title: string, content: string, authorId: string) {
  return prisma.post.create({
    data: { title, content, authorId },
  });
}

export async function getPostsWithAuthor() {
  return prisma.post.findMany({
    include: { author: true },
  });
}

// Valid Drizzle-like queries (mocked for testing query extraction; no real drizzle-orm)
const db = {
  select: (cols?: Record<string, unknown>) => ({
    from: (_table: string) => Promise.resolve([]),
  }),
};
const users = 'users';
const posts = 'posts';

export async function getUsersDrizzle() {
  return db.select().from(users);
}

export async function getPostsDrizzle() {
  const cols = { id: 1, title: 1, authorId: 1 };
  return db.select(cols as Record<string, unknown>).from(posts);
}

// Valid SQL template - tagged template literal for extractor
const sql = (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join('?');
export async function getRecentPosts() {
  return sql`SELECT * FROM "Post" ORDER BY "createdAt" DESC LIMIT 10` as unknown as Promise<unknown[]>;
}
