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

// Valid Drizzle queries
// Note: These are mock imports for testing query extraction
const db = {
  select: () => ({ from: () => Promise.resolve([]) }),
};
const users = 'users';
const posts = 'posts';

export async function getUsersDrizzle() {
  return db.select().from(users);
}

export async function getPostsDrizzle() {
  return db.select({
    id: posts.id,
    title: posts.title,
    authorId: posts.authorId,
  }).from(posts);
}

// Valid SQL template queries
import { sql } from 'drizzle-orm';

export async function getRecentPosts() {
  return sql`SELECT * FROM posts WHERE created_at > NOW() - INTERVAL '7 days'`;
}
