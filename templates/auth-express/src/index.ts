/**
 * Golden Auth Template (Express) — Entry point
 * Production-quality auth with Prisma, JWT (jose), bcrypt, Zod
 */

import express from 'express';
import { requestLogger } from './middleware/request-logger.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import authRoutes from './routes/auth.js';

const app = express();
const PORT = process.env['PORT'] ?? 3000;

app.use(express.json());
app.use(requestLogger);
app.use(corsMiddleware);

app.use('/api/auth', authRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Auth API running on http://localhost:${PORT}`);
});

export default app;
