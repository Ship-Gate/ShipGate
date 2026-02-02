import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { domainService } from '../services/domain';
import type { DomainStatus } from '../db/types';

const router = Router();

// Validation schemas
const createDomainSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  contractPath: z.string().min(1).max(500),
});

const updateDomainSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  contractPath: z.string().min(1).max(500).optional(),
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED', 'OUTDATED']).optional(),
});

const listDomainsSchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED', 'OUTDATED']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name', 'trustScore']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/domains
 * List all domains with pagination and filtering.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listDomainsSchema.parse(req.query);
    
    const result = await domainService.list({
      status: query.status as DomainStatus | undefined,
      search: query.search,
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
 * POST /api/domains
 * Create a new domain.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createDomainSchema.parse(req.body);
    const domain = await domainService.create(input);
    
    res.status(201).json(domain);
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
 * GET /api/domains/:id
 * Get a single domain by ID.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const domain = await domainService.getById(id);

    if (!domain) {
      res.status(404).json({
        error: 'Not Found',
        message: `Domain not found: ${id}`,
      });
      return;
    }

    res.json(domain);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/domains/:id
 * Update a domain.
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const input = updateDomainSchema.parse(req.body);

    const domain = await domainService.update(id, input);
    res.json(domain);
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
        message: `Domain not found: ${req.params.id}`,
      });
      return;
    }
    next(error);
  }
});

/**
 * DELETE /api/domains/:id
 * Delete a domain.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await domainService.delete(id);
    
    res.status(204).send();
  } catch (error) {
    if ((error as Error).message?.includes('Record to delete does not exist')) {
      res.status(404).json({
        error: 'Not Found',
        message: `Domain not found: ${req.params.id}`,
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/domains/:id/verifications
 * Get verifications for a domain.
 */
router.get('/:id/verifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(req.query);

    // Check if domain exists
    const domain = await domainService.getById(id);
    if (!domain) {
      res.status(404).json({
        error: 'Not Found',
        message: `Domain not found: ${id}`,
      });
      return;
    }

    const result = await domainService.getVerifications(id, {
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

export const domainsRouter: Router = router;
