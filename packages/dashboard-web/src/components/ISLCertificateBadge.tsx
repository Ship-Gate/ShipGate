'use client';

/**
 * ISL Certificate Badge
 *
 * Embeddable badge for READMEs and dashboards showing verification status.
 * Displays verdict, trust score, and optional link to certificate.
 */

import { cn } from '@/lib/utils';

export type CertificateVerdict = 'SHIP' | 'NO_SHIP' | 'REVIEW';

export interface ISLCertificateBadgeProps {
  verdict: CertificateVerdict;
  trustScore: number;
  timestamp?: string;
  certificateUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const VERDICT_CONFIG: Record<
  CertificateVerdict,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  SHIP: {
    label: 'SHIP',
    color: 'text-emerald-800',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
  },
  NO_SHIP: {
    label: 'NO_SHIP',
    color: 'text-red-800',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  REVIEW: {
    label: 'REVIEW',
    color: 'text-amber-800',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
  },
};

export function ISLCertificateBadge({
  verdict,
  trustScore,
  timestamp,
  certificateUrl,
  size = 'md',
  className,
}: ISLCertificateBadgeProps) {
  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.REVIEW;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const content = (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-md border',
        config.bgColor,
        config.color,
        config.borderColor,
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label={`ISL Certificate: ${config.label}, Trust: ${trustScore}%`}
    >
      <span className="font-semibold">{config.label}</span>
      <span className="opacity-80">•</span>
      <span>{trustScore}%</span>
      {timestamp && (
        <>
          <span className="opacity-80">•</span>
          <span className="text-xs opacity-75">
            {new Date(timestamp).toLocaleDateString()}
          </span>
        </>
      )}
    </span>
  );

  if (certificateUrl) {
    return (
      <a
        href={certificateUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block hover:opacity-90 transition-opacity"
        title="View ISL Certificate"
      >
        {content}
      </a>
    );
  }

  return content;
}

/**
 * SVG badge for README markdown (shields.io style)
 * Use in README: ![ISL Certificate](url-to-badge-endpoint)
 */
export function ISLCertificateBadgeSVG({
  verdict,
  trustScore,
  timestamp,
}: Pick<ISLCertificateBadgeProps, 'verdict' | 'trustScore' | 'timestamp'>) {
  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.REVIEW;
  const colors: Record<CertificateVerdict, string> = {
    SHIP: '4ade80',
    NO_SHIP: 'f87171',
    REVIEW: 'fbbf24',
  };
  const hex = colors[verdict] ?? colors.REVIEW;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="140"
      height="20"
      role="img"
      aria-label={`ISL: ${config.label} ${trustScore}%`}
    >
      <title>ISL Certificate: {config.label} - {trustScore}%</title>
      <linearGradient id="g" x2="0" y2="100%">
        <stop offset="0" stopColor="#fff" stopOpacity=".7" />
        <stop offset=".1" stopColor="#aaa" stopOpacity=".1" />
        <stop offset=".9" stopColor="#000" stopOpacity=".3" />
        <stop offset="1" stopColor="#000" stopOpacity=".5" />
      </linearGradient>
      <rect width="140" height="20" rx="3" fill="#555" />
      <rect x="70" width="70" height="20" rx="0 3 3 0" fill={`#${hex}`} />
      <rect width="140" height="20" fill="url(#g)" />
      <text
        x="35"
        y="14"
        fill="#fff"
        textAnchor="middle"
        fontFamily="Verdana,Geneva,sans-serif"
        fontSize="11"
      >
        ISL
      </text>
      <text
        x="105"
        y="14"
        fill="#fff"
        textAnchor="middle"
        fontFamily="Verdana,Geneva,sans-serif"
        fontSize="11"
      >
        {config.label} {trustScore}%
      </text>
    </svg>
  );
}
