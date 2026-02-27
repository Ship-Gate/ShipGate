/**
 * Express server for the flagship demo
 * Exposes REST APIs that implement the ISL behavioral contracts
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { OAuthProvider, RefundReason, FileCategory, ScanResult } from './types.js';
import {
  oauthLogin,
  refreshAccessToken,
  logout,
  validateSession,
  createPayment,
  createRefund,
  createSubscription,
  cancelSubscription,
  getPaymentHistory,
  createCustomer,
  initiateUpload,
  completeUpload,
  processFile,
  getFile,
  deleteFile,
  listFiles,
} from './handlers/index.js';
import { resetAllStores } from './store.js';

const app: express.Application = express();
app.use(express.json());

// ============================================
// Middleware
// ============================================

// Simple auth middleware for demo
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // In production, validate the token properly
    (req as Request & { user_id?: string }).user_id = 'demo_user_123';
  }
  next();
}

app.use(authMiddleware);

// ============================================
// Health Check
// ============================================

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Auth Routes
// ============================================

app.post('/auth/oauth/login', async (req: Request, res: Response) => {
  const { provider, oauth_code, redirect_uri } = req.body;
  const ip_address = req.ip || '127.0.0.1';
  const user_agent = req.headers['user-agent'];

  const result = await oauthLogin({
    provider: provider as OAuthProvider,
    oauth_code,
    redirect_uri,
    ip_address,
    user_agent,
  });

  res.status(result.success ? 200 : 400).json(result);
});

app.post('/auth/token/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  const result = await refreshAccessToken({ refresh_token });
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/auth/logout', async (req: Request, res: Response) => {
  const { session_id, revoke_all } = req.body;
  const user_id = (req as Request & { user_id?: string }).user_id || 'anonymous';

  const result = await logout({ session_id, revoke_all }, user_id);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/auth/session/validate', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const access_token = authHeader?.replace('Bearer ', '') || '';

  const result = await validateSession({ access_token });
  res.status(result.success ? 200 : 401).json(result);
});

// ============================================
// Payment Routes
// ============================================

app.post('/payments/customers', async (req: Request, res: Response) => {
  const { email, name, default_payment_method_id } = req.body;

  const customer = await createCustomer(email, name, default_payment_method_id);
  res.status(201).json({ success: true, data: customer });
});

app.post('/payments/charges', async (req: Request, res: Response) => {
  const { customer_id, amount, currency, payment_method_id, description, metadata, idempotency_key } =
    req.body;

  const result = await createPayment({
    customer_id,
    amount,
    currency,
    payment_method_id,
    description,
    metadata,
    idempotency_key,
  });

  res.status(result.success ? 201 : 400).json(result);
});

app.post('/payments/refunds', async (req: Request, res: Response) => {
  const { payment_id, amount, reason, metadata } = req.body;

  const result = await createRefund({
    payment_id,
    amount,
    reason: reason as RefundReason,
    metadata,
  });

  res.status(result.success ? 201 : 400).json(result);
});

app.post('/payments/subscriptions', async (req: Request, res: Response) => {
  const { customer_id, plan_id, payment_method_id, trial_days, metadata } = req.body;

  const result = await createSubscription({
    customer_id,
    plan_id,
    payment_method_id,
    trial_days,
    metadata,
  });

  res.status(result.success ? 201 : 400).json(result);
});

app.post('/payments/subscriptions/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { cancel_immediately, reason } = req.body;

  const result = await cancelSubscription({
    subscription_id: id,
    cancel_immediately,
    reason,
  });

  res.status(result.success ? 200 : 400).json(result);
});

app.get('/payments/customers/:id/payments', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit, starting_after, status } = req.query;

  const result = await getPaymentHistory({
    customer_id: id,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    starting_after: starting_after as string,
    status: status as any,
  });

  res.status(result.success ? 200 : 400).json(result);
});

// ============================================
// Upload Routes
// ============================================

app.post('/uploads/initiate', async (req: Request, res: Response) => {
  const { filename, mime_type, size, category, metadata } = req.body;
  const user_id = (req as Request & { user_id?: string }).user_id || 'demo_user_123';

  const result = await initiateUpload(
    {
      filename,
      mime_type,
      size,
      category: category as FileCategory,
      metadata,
    },
    user_id
  );

  res.status(result.success ? 201 : 400).json(result);
});

app.post('/uploads/:id/complete', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { checksum, etag } = req.body;
  const user_id = (req as Request & { user_id?: string }).user_id || 'demo_user_123';

  const result = await completeUpload({ file_id: id, checksum, etag }, user_id);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/uploads/:id/process', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { scan_result } = req.body;

  const result = await processFile({
    file_id: id,
    scan_result: scan_result as ScanResult,
  });

  res.status(result.success ? 200 : 400).json(result);
});

app.get('/uploads/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { variant } = req.query;
  const user_id = (req as Request & { user_id?: string }).user_id;

  const result = await getFile({ file_id: id, variant: variant as string }, user_id);
  res.status(result.success ? 200 : 400).json(result);
});

app.delete('/uploads/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { permanent } = req.query;
  const user_id = (req as Request & { user_id?: string }).user_id || 'demo_user_123';

  const result = await deleteFile(
    { file_id: id, permanent: permanent === 'true' },
    user_id
  );

  res.status(result.success ? 200 : 400).json(result);
});

app.get('/uploads', async (req: Request, res: Response) => {
  const { category, status, limit, cursor } = req.query;
  const user_id = (req as Request & { user_id?: string }).user_id || 'demo_user_123';

  const result = await listFiles(
    {
      category: category as FileCategory,
      status: status as any,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: cursor as string,
    },
    user_id
  );

  res.status(result.success ? 200 : 400).json(result);
});

// ============================================
// Demo/Test Routes
// ============================================

app.post('/demo/reset', (_req: Request, res: Response) => {
  resetAllStores();
  res.json({ success: true, message: 'All stores reset' });
});

// ============================================
// Error Handler
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    },
  });
});

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 3000;

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  app.listen(PORT, () => {
    console.log(`Flagship Demo Server running on http://localhost:${PORT}`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  Auth:');
    console.log('    POST /auth/oauth/login');
    console.log('    POST /auth/token/refresh');
    console.log('    POST /auth/logout');
    console.log('    GET  /auth/session/validate');
    console.log('');
    console.log('  Payments:');
    console.log('    POST /payments/customers');
    console.log('    POST /payments/charges');
    console.log('    POST /payments/refunds');
    console.log('    POST /payments/subscriptions');
    console.log('    POST /payments/subscriptions/:id/cancel');
    console.log('    GET  /payments/customers/:id/payments');
    console.log('');
    console.log('  Uploads:');
    console.log('    POST /uploads/initiate');
    console.log('    POST /uploads/:id/complete');
    console.log('    POST /uploads/:id/process');
    console.log('    GET  /uploads/:id');
    console.log('    DELETE /uploads/:id');
    console.log('    GET  /uploads');
  });
}

export { app };
