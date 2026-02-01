/**
 * Trust Score Routes
 * 
 * Endpoints for trust score calculation and incident management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { IncidentSeverity } from '@prisma/client';
import {
  calculateTrustScore,
  reportIncident,
  resolveIncident,
  compareTrust,
} from '../services/trust.js';

export const trustRouter = Router();

/**
 * Handle async route errors
 */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Format Zod errors for API response
 */
function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map(e => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

/**
 * GET /api/intents/:name/trust
 * Get trust score for a package
 */
trustRouter.get('/:name/trust', asyncHandler(async (req, res) => {
  const { name } = req.params;

  try {
    const report = await calculateTrustScore(name);

    res.json({
      packageName: report.packageName,
      trustScore: report.score.overall,
      recommendation: report.recommendation,
      breakdown: {
        verification: {
          score: report.score.verificationScore,
          weight: 40,
        },
        deployment: {
          score: report.score.deploymentScore,
          weight: 25,
        },
        incident: {
          score: report.score.incidentScore,
          weight: 20,
        },
        age: {
          score: report.score.ageScore,
          weight: 5,
        },
        community: {
          score: report.score.communityScore,
          weight: 5,
        },
        security: {
          score: report.score.securityScore,
          weight: 5,
        },
      },
      factors: report.factors.map(f => ({
        name: f.name,
        impact: f.impact,
        description: f.description,
      })),
      history: report.history.slice(0, 5).map(h => ({
        date: h.date,
        event: h.event,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    throw error;
  }
}));

/**
 * GET /api/intents/:name/trust/badge
 * Get a trust badge (for embedding)
 */
trustRouter.get('/:name/trust/badge', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const { format = 'json' } = req.query;

  try {
    const report = await calculateTrustScore(name);

    if (format === 'svg') {
      // Generate SVG badge
      const color = report.score.overall >= 90 ? '#4CAF50' :
                   report.score.overall >= 70 ? '#FFC107' :
                   report.score.overall >= 50 ? '#FF9800' : '#F44336';
      
      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <rect width="120" height="20" fill="#555"/>
  <rect x="60" width="60" height="20" fill="${color}"/>
  <text x="30" y="14" fill="#fff" font-family="Verdana" font-size="11" text-anchor="middle">trust</text>
  <text x="90" y="14" fill="#fff" font-family="Verdana" font-size="11" text-anchor="middle">${report.score.overall}%</text>
</svg>`.trim();

      res.type('image/svg+xml').send(svg);
      return;
    }

    // JSON badge info
    res.json({
      schemaVersion: 1,
      label: 'trust',
      message: `${report.score.overall}%`,
      color: report.score.overall >= 90 ? 'brightgreen' :
             report.score.overall >= 70 ? 'yellow' :
             report.score.overall >= 50 ? 'orange' : 'red',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    throw error;
  }
}));

/**
 * POST /api/intents/:name/trust/incident
 * Report an incident affecting trust
 */
trustRouter.post('/:name/trust/incident', asyncHandler(async (req, res) => {
  const { name } = req.params;

  const incidentSchema = z.object({
    severity: z.nativeEnum(IncidentSeverity),
    title: z.string().min(5).max(200),
    description: z.string().min(10).max(5000),
    reportedBy: z.string().min(2).max(64),
    version: z.string().optional(),
  });

  try {
    const input = incidentSchema.parse(req.body);
    
    await reportIncident(
      name,
      input.severity,
      input.title,
      input.description,
      input.reportedBy,
      input.version
    );

    res.status(201).json({
      message: 'Incident reported successfully',
      note: 'The trust score has been recalculated',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: formatZodError(error),
      });
      return;
    }
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    throw error;
  }
}));

/**
 * POST /api/trust/incidents/:id/resolve
 * Resolve an incident
 */
trustRouter.post('/trust/incidents/:id/resolve', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    await resolveIncident(id);

    res.json({
      message: 'Incident resolved',
      note: 'The trust score has been recalculated',
    });
  } catch {
    res.status(404).json({
      error: 'Not Found',
      message: 'Incident not found',
    });
  }
}));

/**
 * POST /api/trust/compare
 * Compare trust scores between packages
 */
trustRouter.post('/trust/compare', asyncHandler(async (req, res) => {
  const compareSchema = z.object({
    packages: z.array(z.string()).min(2).max(10),
  });

  try {
    const { packages } = compareSchema.parse(req.body);
    const reports = await compareTrust(packages);

    res.json({
      comparison: reports.map(r => ({
        packageName: r.packageName,
        trustScore: r.score.overall,
        recommendation: r.recommendation,
        breakdown: {
          verification: r.score.verificationScore,
          deployment: r.score.deploymentScore,
          incident: r.score.incidentScore,
        },
      })).sort((a, b) => b.trustScore - a.trustScore),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: formatZodError(error),
      });
      return;
    }
    throw error;
  }
}));

/**
 * GET /api/trust/recommendations
 * Get trust score thresholds and recommendations
 */
trustRouter.get('/trust/recommendations', (_req, res) => {
  res.json({
    thresholds: {
      production_ready: {
        minScore: 90,
        description: 'Safe for production use with high confidence',
      },
      staging_ready: {
        minScore: 80,
        description: 'Good for staging and beta environments',
      },
      development_only: {
        minScore: 60,
        description: 'Use in development, more verification needed',
      },
      experimental: {
        minScore: 40,
        description: 'Experimental, requires significant verification',
      },
      not_recommended: {
        minScore: 0,
        description: 'Not recommended - too many issues or unverified',
      },
    },
    factors: [
      { name: 'Verification', weight: 40, description: 'Test results from formal verification' },
      { name: 'Deployment', weight: 25, description: 'Adoption and production usage' },
      { name: 'Incidents', weight: 20, description: 'Reported issues and their severity' },
      { name: 'Age', weight: 5, description: 'Package maturity and stability' },
      { name: 'Community', weight: 5, description: 'Stars and community engagement' },
      { name: 'Security', weight: 5, description: 'Security audits and vulnerabilities' },
    ],
  });
});
