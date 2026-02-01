import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verificationService } from '../services/verification';
import { VerificationStatus, TestStatus } from '@prisma/client';

const router = Router();

// Validation schemas
const createVerificationSchema = z.object({
  domainId: z.string().min(1),
});

const updateVerificationSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED']).optional(),
  totalTests: z.number().int().min(0).optional(),
  passedTests: z.number().int().min(0).optional(),
  failedTests: z.number().int().min(0).optional(),
  coverage: z.number().min(0).max(100).optional(),
  duration: z.number().int().min(0).optional(),
  report: z.string().optional(),
  errorLog: z.string().optional(),
});

const addTestResultSchema = z.object({
  testName: z.string().min(1),
  category: z.string().optional(),
  status: z.enum(['PENDING', 'PASSED', 'FAILED', 'SKIPPED']),
  duration: z.number().int().min(0).optional(),
  errorMessage: z.string().optional(),
  stackTrace: z.string().optional(),
});

const listVerificationsSchema = z.object({
  domainId: z.string().optional(),
  status: z.enum(['PENDING', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum(['createdAt', 'completedAt', 'duration']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/verifications
 * List all verifications with pagination and filtering.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listVerificationsSchema.parse(req.query);

    const result = await verificationService.list({
      domainId: query.domainId,
      status: query.status as VerificationStatus | undefined,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: query.orderBy,
      order: query.order,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/verifications
 * Create a new verification run.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createVerificationSchema.parse(req.body);
    const verification = await verificationService.create(input);

    res.status(201).json(verification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    if ((error as Error).message?.includes('Domain not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: (error as Error).message,
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/verifications/:id
 * Get a single verification by ID.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const verification = await verificationService.getById(id);

    if (!verification) {
      res.status(404).json({
        error: 'Not Found',
        message: `Verification not found: ${id}`,
      });
      return;
    }

    res.json(verification);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/verifications/:id
 * Update a verification.
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const input = updateVerificationSchema.parse(req.body);

    const verification = await verificationService.update(id, input);
    res.json(verification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    if ((error as Error).message?.includes('Record to update not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: `Verification not found: ${req.params.id}`,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/verifications/:id/start
 * Start a verification run.
 */
router.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const verification = await verificationService.start(id);

    res.json(verification);
  } catch (error) {
    if ((error as Error).message?.includes('Record to update not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: `Verification not found: ${req.params.id}`,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/verifications/:id/complete
 * Complete a verification run.
 */
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const input = z.object({
      passed: z.number().int().min(0),
      failed: z.number().int().min(0),
      coverage: z.number().min(0).max(100).optional(),
    }).parse(req.body);

    const verification = await verificationService.complete(id, input);
    res.json(verification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    if ((error as Error).message?.includes('Record to update not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: `Verification not found: ${req.params.id}`,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/verifications/:id/cancel
 * Cancel a verification run.
 */
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const verification = await verificationService.cancel(id);

    res.json(verification);
  } catch (error) {
    if ((error as Error).message?.includes('Record to update not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: `Verification not found: ${req.params.id}`,
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/verifications/:id/results
 * Add a test result to a verification.
 */
router.post('/:id/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const input = addTestResultSchema.parse(req.body);

    const result = await verificationService.addTestResult({
      verificationId: id,
      testName: input.testName,
      category: input.category,
      status: input.status as TestStatus,
      duration: input.duration,
      errorMessage: input.errorMessage,
      stackTrace: input.stackTrace,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/verifications/:id/results
 * Get test results for a verification.
 */
router.get('/:id/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(500).default(100),
    }).parse(req.query);

    // Check if verification exists
    const verification = await verificationService.getById(id);
    if (!verification) {
      res.status(404).json({
        error: 'Not Found',
        message: `Verification not found: ${id}`,
      });
      return;
    }

    const result = await verificationService.getTestResults(id, {
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.errors,
      });
      return;
    }
    next(error);
  }
});

export const verificationsRouter = router;
