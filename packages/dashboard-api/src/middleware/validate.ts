import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';

/**
 * Middleware factory: validates `req.body` against the given Zod schema.
 * On failure, responds 400 with structured error details.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: formatZodError(result.error),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory: validates `req.query` against the given Zod schema.
 * On failure, responds 400 with structured error details.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: formatZodError(result.error),
      });
      return;
    }
    // Overwrite query with coerced/defaulted values
    req.query = result.data as Record<string, string>;
    next();
  };
}

function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
