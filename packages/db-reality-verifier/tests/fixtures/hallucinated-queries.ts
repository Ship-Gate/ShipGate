// Hallucinated queries - these reference tables/columns that don't exist

// Mock imports for testing
const prisma = {
  users: { findMany: () => Promise.resolve([]) },
  user: { findMany: () => Promise.resolve([]) },
  commment: { findMany: () => Promise.resolve([]) },
  post: { findMany: () => Promise.resolve([]) },
};
const db = {
  select: () => ({ from: () => Promise.resolve([]) }),
};
const sql = (strings: TemplateStringsArray) => strings.join('');
const post = 'post';

// Hallucination 1: Non-existent table (typo: "Users" instead of "User")
export async function getUsersWrong() {
  return prisma.users.findMany(); // Should be "user" (lowercase)
}

// Hallucination 2: Non-existent column
export async function getUserWrongColumn() {
  return prisma.user.findMany({
    select: { id: true, email: true, username: true }, // "username" doesn't exist, should be "name"
  });
}

// Hallucination 3: Non-existent table in Drizzle
export async function getPostsWrongTable() {
  const post = 'post'; // Should be "posts" (plural)
  return db.select().from(post);
}

// Hallucination 4: Non-existent column in SQL
export async function getPostsWrongColumn() {
  return sql`SELECT id, title, author_name FROM posts`; // "author_name" doesn't exist
}

// Hallucination 5: Typo in table name (close match)
export async function getCommments() {
  return prisma.commment.findMany(); // Typo: "commment" instead of "comment"
}

// Hallucination 6: Wrong relation
export async function getPostWithWrongRelation() {
  return prisma.post.findMany({
    include: { comments: true, tags: true }, // "tags" relation doesn't exist
  });
}
