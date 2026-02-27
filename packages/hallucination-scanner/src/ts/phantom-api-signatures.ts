/**
 * Phantom API Signatures Database
 *
 * Known hallucinated or deprecated API patterns that AI code generators
 * frequently produce. These methods/properties don't exist in the actual packages.
 *
 * @module @isl-lang/hallucination-scanner/ts/phantom-api-signatures
 */

export type PhantomApiSeverity = 'critical' | 'high' | 'medium';

export interface PhantomApiSignature {
  /** Package name (e.g. "prisma", "stripe") */
  package: string;
  /** Method chain pattern to match (e.g. ".findByEmail", ".charges.create") */
  pattern: string | RegExp;
  /** Human-readable description of the hallucination */
  message: string;
  /** Correct usage suggestion */
  suggestion: string;
  /** Severity: critical = method doesn't exist, high = deprecated, medium = wrong pattern */
  severity: PhantomApiSeverity;
}

/**
 * Curated list of phantom API patterns.
 * Add new entries as AI hallucinations are discovered.
 */
export const PHANTOM_API_SIGNATURES: PhantomApiSignature[] = [
  // ── Prisma ─────────────────────────────────────────────────────────────
  {
    package: 'prisma',
    pattern: '.findByEmail',
    message: 'Prisma has no findByEmail method',
    suggestion: 'Use findUnique({ where: { email } }) or findFirst({ where: { email } })',
    severity: 'critical',
  },
  {
    package: 'prisma',
    pattern: '.findByEmailAndPassword',
    message: 'Prisma has no findByEmailAndPassword method',
    suggestion: 'Use findUnique({ where: { email } }) then verify password separately',
    severity: 'critical',
  },
  {
    package: 'prisma',
    pattern: '.findById',
    message: 'Prisma has no findById method',
    suggestion: 'Use findUnique({ where: { id } })',
    severity: 'critical',
  },
  {
    package: 'prisma',
    pattern: '.createUser',
    message: 'Prisma model has no createUser method',
    suggestion: 'Use prisma.user.create({ data: { ... } })',
    severity: 'critical',
  },
  {
    package: 'prisma',
    pattern: '.updateUser',
    message: 'Prisma model has no updateUser method',
    suggestion: 'Use prisma.user.update({ where: { id }, data: { ... } })',
    severity: 'critical',
  },
  {
    package: 'prisma',
    pattern: '.deleteUser',
    message: 'Prisma model has no deleteUser method',
    suggestion: 'Use prisma.user.delete({ where: { id } })',
    severity: 'critical',
  },
  {
    package: 'prisma',
    pattern: '.findManyAndCount',
    message: 'Prisma has no findManyAndCount',
    suggestion: 'Use findMany() and count() separately, or use $transaction',
    severity: 'critical',
  },

  // ── Stripe ──────────────────────────────────────────────────────────────
  {
    package: 'stripe',
    pattern: '.charges.create',
    message: 'stripe.charges.create is deprecated for most payment flows',
    suggestion: 'Use stripe.paymentIntents.create() for SCA-compliant payments',
    severity: 'high',
  },
  {
    package: 'stripe',
    pattern: '.customers.retrieve',
    message: 'Stripe customers API uses different method names',
    suggestion: 'Use stripe.customers.retrieve(id) — verify the method exists in your Stripe SDK version',
    severity: 'medium',
  },

  // ── Next.js ─────────────────────────────────────────────────────────────
  {
    package: 'next',
    pattern: '.getServerSideProps',
    message: 'getServerSideProps is a page export, not a method',
    suggestion: 'Export getServerSideProps from the page file: export async function getServerSideProps(context)',
    severity: 'critical',
  },
  {
    package: 'next',
    pattern: 'getStaticPaths',
    message: 'getStaticPaths is a page export, not a method',
    suggestion: 'Export getStaticPaths from the page file',
    severity: 'critical',
  },

  // ── Express ─────────────────────────────────────────────────────────────
  {
    package: 'express',
    pattern: '.bodyParser',
    message: 'express.bodyParser was removed in Express 4',
    suggestion: 'Use express.json() and express.urlencoded({ extended: true })',
    severity: 'critical',
  },
  {
    package: 'express',
    pattern: 'req.param(',
    message: 'req.param() is deprecated',
    suggestion: 'Use req.params, req.query, or req.body depending on the data source',
    severity: 'high',
  },

  // ── Mongoose ───────────────────────────────────────────────────────────
  {
    package: 'mongoose',
    pattern: '.findByEmail',
    message: 'Mongoose Schema has no built-in findByEmail',
    suggestion: 'Create a static method: UserSchema.statics.findByEmail = function(email) { return this.findOne({ email }); }',
    severity: 'critical',
  },
  {
    package: 'mongoose',
    pattern: '.findOneAndUpdate',
    message: 'findOneAndUpdate returns the old document by default',
    suggestion: 'Use { new: true } option to return the updated document',
    severity: 'medium',
  },

  // ── React / React Native ────────────────────────────────────────────────
  {
    package: 'react',
    pattern: '.findDOMNode',
    message: 'findDOMNode is deprecated in React',
    suggestion: 'Use refs or ReactDOM.findDOMNode only when migrating legacy code',
    severity: 'high',
  },

  // ── Drizzle ────────────────────────────────────────────────────────────
  {
    package: 'drizzle',
    pattern: '.findByEmail',
    message: 'Drizzle has no findByEmail method',
    suggestion: 'Use db.select().from(users).where(eq(users.email, email))',
    severity: 'critical',
  },

  // ── Fastify ────────────────────────────────────────────────────────────
  {
    package: 'fastify',
    pattern: '\.use\s*\(\s*bodyParser',
    message: 'Fastify has no bodyParser middleware',
    suggestion: 'Use @fastify/formbody or @fastify/multipart for body parsing',
    severity: 'critical',
  },

  // ── Next.js (additional) ───────────────────────────────────────────────
  {
    package: 'next',
    pattern: 'next\.config\.(js|ts).*getServerSideProps',
    message: 'getServerSideProps belongs in page files, not next.config',
    suggestion: 'Export getServerSideProps from pages/[slug].tsx',
    severity: 'critical',
  },
  {
    package: 'next',
    pattern: 'import.*getServerSideProps.*from.*next',
    message: 'getServerSideProps is not imported from next',
    suggestion: 'Define getServerSideProps in the page file; it is auto-discovered',
    severity: 'critical',
  },

  // ── Express (additional) ──────────────────────────────────────────────
  {
    package: 'express',
    pattern: 'app\.use\s*\(\s*bodyParser\s*\(\s*\)',
    message: 'bodyParser() is deprecated; Express 4.16+ has built-in json/urlencoded',
    suggestion: 'Use app.use(express.json()) and app.use(express.urlencoded({ extended: true }))',
    severity: 'high',
  },
  {
    package: 'express',
    pattern: 'express\.bodyParser',
    message: 'express.bodyParser was removed in Express 4',
    suggestion: 'Use express.json() and express.urlencoded({ extended: true })',
    severity: 'critical',
  },

  // ── Stripe (additional) ────────────────────────────────────────────────
  {
    package: 'stripe',
    pattern: 'stripe\.subscriptions\.create\s*\(\s*\{\s*customer:',
    message: 'Stripe subscriptions API may require different parameters',
    suggestion: 'Verify Stripe API version; use stripe.subscriptions.create({ customer, items })',
    severity: 'medium',
  },

  // ── React (additional) ──────────────────────────────────────────────────
  {
    package: 'react',
    pattern: 'componentDidMount\s*\(\s*\)',
    message: 'componentDidMount is for class components only',
    suggestion: 'Use useEffect(() => {...}, []) in function components',
    severity: 'high',
  },
  {
    package: 'react',
    pattern: 'this\.setState\s*\(',
    message: 'setState is for class components only',
    suggestion: 'Use useState() hook in function components',
    severity: 'high',
  },
  {
    package: 'react',
    pattern: 'React\.createClass',
    message: 'React.createClass was removed in React 16',
    suggestion: 'Use class Component extends React.Component or function components',
    severity: 'critical',
  },

  // ── Axios ───────────────────────────────────────────────────────────────
  {
    package: 'axios',
    pattern: 'axios\.get\s*\(\s*\)',
    message: 'axios.get requires a URL as first argument',
    suggestion: 'Use axios.get(url, config)',
    severity: 'critical',
  },

  // ── Zod ────────────────────────────────────────────────────────────────
  {
    package: 'zod',
    pattern: 'z\.parse\s*\(\s*\)',
    message: 'z.parse requires input',
    suggestion: 'Use z.parse(data) or schema.safeParse(data)',
    severity: 'medium',
  },

  // ── Knex ──────────────────────────────────────────────────────────────
  {
    package: 'knex',
    pattern: '\.findByEmail',
    message: 'Knex has no findByEmail',
    suggestion: 'Use knex("users").where({ email }).first()',
    severity: 'critical',
  },

  // ── Sequelize ───────────────────────────────────────────────────────────
  {
    package: 'sequelize',
    pattern: 'Model\.findByEmail',
    message: 'Sequelize Model has no built-in findByEmail',
    suggestion: 'Use Model.findOne({ where: { email } })',
    severity: 'critical',
  },
];
