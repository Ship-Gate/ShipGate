/**
 * ISL Demo Application
 * 
 * This demo intentionally contains security issues
 * that ISL Gate will detect:
 * 
 * - Auth: Unprotected routes, missing rate limits
 * - PII: Logged sensitive data, unmasked responses
 * - Rate Limit: Missing on auth endpoints
 */

import express from 'express';
import loginRouter from './auth/login.js';
import usersRouter from './api/users.js';
import adminRouter from './api/admin.js';
import { log } from './utils/logger.js';

const app = express();
app.use(express.json());

// Routes
app.use('/auth', loginRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
});

export default app;
