/**
 * Trust Score Service
 * 
 * Calculates and manages trust scores for intent packages.
 * Trust score = f(verifications, deployments, incidents, age)
 */

import { PrismaClient, IncidentSeverity, TrustMetrics } from '@prisma/client';

const prisma = new PrismaClient();

export interface TrustScoreBreakdown {
  overall: number;            // 0-100 final score
  verificationScore: number;  // Based on verification history
  deploymentScore: number;    // Based on deployment count
  incidentScore: number;      // Based on incidents (negative)
  ageScore: number;           // Based on package maturity
  communityScore: number;     // Stars, forks, contributors
  securityScore: number;      // Security audits, vulnerabilities
}

export interface TrustReport {
  packageName: string;
  version?: string;
  score: TrustScoreBreakdown;
  recommendation: TrustRecommendation;
  factors: TrustFactor[];
  history: TrustHistoryEntry[];
}

export type TrustRecommendation = 
  | 'production_ready'      // 90-100: Safe for production
  | 'staging_ready'         // 80-89: Good for staging/beta
  | 'development_only'      // 60-79: Use in development
  | 'experimental'          // 40-59: Experimental, needs more verification
  | 'not_recommended';      // 0-39: Too many issues

export interface TrustFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface TrustHistoryEntry {
  date: Date;
  score: number;
  event: string;
}

// Weights for trust calculation
const TRUST_WEIGHTS = {
  verification: 40,   // Most important - actual test results
  deployment: 25,     // Community adoption signal
  incident: 20,       // Negative factor for issues
  age: 5,             // Maturity bonus
  community: 5,       // Stars, contributors
  security: 5,        // Audit status
};

// Incident severity penalties
const INCIDENT_PENALTIES = {
  [IncidentSeverity.LOW]: 2,
  [IncidentSeverity.MEDIUM]: 5,
  [IncidentSeverity.HIGH]: 15,
  [IncidentSeverity.CRITICAL]: 30,
};

/**
 * Calculate trust score for a package
 */
export async function calculateTrustScore(packageName: string): Promise<TrustReport> {
  const pkg = await prisma.intentPackage.findUnique({
    where: { name: packageName },
    include: {
      versions: {
        include: {
          verifications: {
            orderBy: { runAt: 'desc' },
          },
        },
      },
      trustMetrics: true,
    },
  });

  if (!pkg) {
    throw new Error(`Package '${packageName}' not found`);
  }

  const factors: TrustFactor[] = [];

  // 1. Verification Score
  const verificationScore = calculateVerificationScore(pkg.versions, factors);

  // 2. Deployment Score
  const deploymentScore = await calculateDeploymentScore(packageName, factors);

  // 3. Incident Score (negative impact)
  const incidentScore = await calculateIncidentScore(packageName, factors);

  // 4. Age Score
  const ageScore = calculateAgeScore(pkg.createdAt, factors);

  // 5. Community Score
  const communityScore = calculateCommunityScore(pkg.stars, factors);

  // 6. Security Score (from metrics or default)
  const securityScore = pkg.trustMetrics?.securityScore ?? 50;
  factors.push({
    name: 'Security Status',
    impact: securityScore >= 70 ? 'positive' : securityScore >= 40 ? 'neutral' : 'negative',
    weight: TRUST_WEIGHTS.security,
    description: securityScore >= 70 
      ? 'No known vulnerabilities' 
      : 'Security audit recommended',
  });

  // Calculate weighted overall score
  const overall = Math.round(
    (verificationScore * TRUST_WEIGHTS.verification +
     deploymentScore * TRUST_WEIGHTS.deployment +
     incidentScore * TRUST_WEIGHTS.incident +
     ageScore * TRUST_WEIGHTS.age +
     communityScore * TRUST_WEIGHTS.community +
     securityScore * TRUST_WEIGHTS.security) / 100
  );

  // Determine recommendation
  const recommendation = getRecommendation(overall);

  // Get history
  const history = await getTrustHistory(packageName);

  // Update stored metrics
  await updateTrustMetrics(pkg.id, {
    trustScore: overall,
    verificationCount: pkg.versions.reduce((sum, v) => sum + v.verifications.length, 0),
  });

  return {
    packageName,
    score: {
      overall,
      verificationScore,
      deploymentScore,
      incidentScore,
      ageScore,
      communityScore,
      securityScore,
    },
    recommendation,
    factors,
    history,
  };
}

/**
 * Calculate score from verification history
 */
function calculateVerificationScore(
  versions: Array<{ verifications: Array<{ status: string; trustScore: number | null; passedTests: number; totalTests: number }> }>,
  factors: TrustFactor[]
): number {
  const allVerifications = versions.flatMap(v => v.verifications);
  
  if (allVerifications.length === 0) {
    factors.push({
      name: 'No Verifications',
      impact: 'negative',
      weight: TRUST_WEIGHTS.verification,
      description: 'Package has not been verified yet',
    });
    return 20; // Low base score for unverified
  }

  const passedVerifications = allVerifications.filter(v => v.status === 'PASSED');
  const passRate = passedVerifications.length / allVerifications.length;

  // Calculate average pass rate from tests
  const testResults = allVerifications
    .filter(v => v.totalTests > 0)
    .map(v => v.passedTests / v.totalTests);
  
  const avgTestPassRate = testResults.length > 0
    ? testResults.reduce((a, b) => a + b, 0) / testResults.length
    : 0.5;

  const score = Math.round((passRate * 0.6 + avgTestPassRate * 0.4) * 100);

  factors.push({
    name: 'Verification History',
    impact: score >= 80 ? 'positive' : score >= 50 ? 'neutral' : 'negative',
    weight: TRUST_WEIGHTS.verification,
    description: `${passedVerifications.length}/${allVerifications.length} verifications passed (${Math.round(passRate * 100)}%)`,
  });

  return score;
}

/**
 * Calculate score from deployment count
 */
async function calculateDeploymentScore(
  packageName: string,
  factors: TrustFactor[]
): Promise<number> {
  const deploymentCount = await prisma.deployment.count({
    where: { packageName },
  });

  // Production deployments count more
  const prodDeployments = await prisma.deployment.count({
    where: { packageName, environment: 'production' },
  });

  // Log scale for adoption - more deployments = higher score
  // Cap at 100 deployments for max score
  const baseScore = Math.min(Math.log10(deploymentCount + 1) / Math.log10(101) * 100, 100);
  const prodBonus = Math.min(prodDeployments * 2, 20);
  
  const score = Math.round(Math.min(baseScore + prodBonus, 100));

  factors.push({
    name: 'Deployment Adoption',
    impact: score >= 60 ? 'positive' : score >= 30 ? 'neutral' : 'negative',
    weight: TRUST_WEIGHTS.deployment,
    description: `${deploymentCount} total deployments (${prodDeployments} production)`,
  });

  return score;
}

/**
 * Calculate score penalty from incidents
 */
async function calculateIncidentScore(
  packageName: string,
  factors: TrustFactor[]
): Promise<number> {
  const incidents = await prisma.incident.findMany({
    where: {
      packageName,
      status: { in: ['OPEN', 'INVESTIGATING'] },
    },
  });

  if (incidents.length === 0) {
    factors.push({
      name: 'No Active Incidents',
      impact: 'positive',
      weight: TRUST_WEIGHTS.incident,
      description: 'No open incidents reported',
    });
    return 100;
  }

  // Calculate penalty
  const totalPenalty = incidents.reduce(
    (sum, incident) => sum + INCIDENT_PENALTIES[incident.severity],
    0
  );

  const score = Math.max(100 - totalPenalty, 0);

  factors.push({
    name: 'Active Incidents',
    impact: 'negative',
    weight: TRUST_WEIGHTS.incident,
    description: `${incidents.length} active incident(s) affecting trust score`,
  });

  return score;
}

/**
 * Calculate score from package age
 */
function calculateAgeScore(createdAt: Date, factors: TrustFactor[]): number {
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // Packages older than 90 days get full score
  // Linear scale up to 90 days
  const score = Math.round(Math.min(ageInDays / 90 * 100, 100));

  factors.push({
    name: 'Package Maturity',
    impact: score >= 80 ? 'positive' : 'neutral',
    weight: TRUST_WEIGHTS.age,
    description: `Package is ${Math.round(ageInDays)} days old`,
  });

  return score;
}

/**
 * Calculate community score from stars
 */
function calculateCommunityScore(stars: number, factors: TrustFactor[]): number {
  // Log scale - cap at 1000 stars for max score
  const score = Math.round(Math.min(Math.log10(stars + 1) / Math.log10(1001) * 100, 100));

  factors.push({
    name: 'Community Interest',
    impact: score >= 50 ? 'positive' : 'neutral',
    weight: TRUST_WEIGHTS.community,
    description: `${stars} stars from the community`,
  });

  return score;
}

/**
 * Determine recommendation based on overall score
 */
function getRecommendation(score: number): TrustRecommendation {
  if (score >= 90) return 'production_ready';
  if (score >= 80) return 'staging_ready';
  if (score >= 60) return 'development_only';
  if (score >= 40) return 'experimental';
  return 'not_recommended';
}

/**
 * Get trust score history for a package
 */
async function getTrustHistory(packageName: string): Promise<TrustHistoryEntry[]> {
  // Get verification events that might have changed trust
  const pkg = await prisma.intentPackage.findUnique({
    where: { name: packageName },
    include: {
      versions: {
        include: {
          verifications: {
            orderBy: { runAt: 'desc' },
            take: 10,
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!pkg) return [];

  const history: TrustHistoryEntry[] = [];

  // Add version publish events
  for (const version of pkg.versions) {
    history.push({
      date: version.publishedAt,
      score: 0, // Would need historical tracking
      event: `Version ${version.version} published`,
    });

    // Add verification events
    for (const verification of version.verifications) {
      history.push({
        date: verification.runAt,
        score: verification.trustScore ?? 0,
        event: `Verification ${verification.status.toLowerCase()}`,
      });
    }
  }

  return history.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
}

/**
 * Update stored trust metrics
 */
async function updateTrustMetrics(
  packageId: string,
  updates: Partial<TrustMetrics>
): Promise<void> {
  await prisma.trustMetrics.upsert({
    where: { packageId },
    update: {
      ...updates,
      updatedAt: new Date(),
    },
    create: {
      packageId,
      trustScore: updates.trustScore ?? 0,
      verificationCount: updates.verificationCount ?? 0,
    },
  });
}

/**
 * Report an incident affecting trust
 */
export async function reportIncident(
  packageName: string,
  severity: IncidentSeverity,
  title: string,
  description: string,
  reportedBy: string,
  version?: string
): Promise<void> {
  await prisma.incident.create({
    data: {
      packageName,
      version,
      severity,
      title,
      description,
      reportedBy,
    },
  });

  // Recalculate trust score
  await calculateTrustScore(packageName);
}

/**
 * Resolve an incident
 */
export async function resolveIncident(incidentId: string): Promise<void> {
  const incident = await prisma.incident.update({
    where: { id: incidentId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
  });

  // Recalculate trust score
  await calculateTrustScore(incident.packageName);
}

/**
 * Get trust comparison between packages
 */
export async function compareTrust(packageNames: string[]): Promise<TrustReport[]> {
  return Promise.all(packageNames.map(name => calculateTrustScore(name)));
}
