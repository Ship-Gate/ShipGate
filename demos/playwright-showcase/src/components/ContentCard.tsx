import type { LucideIcon } from 'lucide-react';
import './ContentCard.css';

export interface ContentCardStat {
  icon: LucideIcon;
  value: string;
}

interface ContentCardProps {
  /** Optional icon shown above title (soft card style) */
  icon?: LucideIcon;
  title: string;
  showBadge?: boolean;
  description: string;
  stats?: ContentCardStat[];
  actionLabel?: string;
  onAction?: () => void;
  /** Show top-right circle (X) */
  showCircle?: boolean;
  /** Smaller variant for grids */
  compact?: boolean;
  /** Run showCard animation on mount */
  animate?: boolean;
  /** Unused in soft style; kept for API compatibility */
  media?: React.ReactNode;
}

export default function ContentCard({
  icon: Icon,
  title,
  showBadge: _showBadge = false,
  description,
  stats = [],
  actionLabel,
  onAction,
  showCircle = false,
  compact = false,
  animate = true,
}: ContentCardProps) {
  return (
    <article
      className={`content-card ${compact ? 'content-card--compact' : ''} ${animate ? 'content-card--animate' : ''}`}
    >
      {showCircle && <div className="content-card__circle" aria-hidden />}

      {Icon && (
        <div className="content-card__icon-wrap">
          <Icon size={22} strokeWidth={2} className="text-white" />
        </div>
      )}

      <h2 className="content-card__name">{title}</h2>
      <p className="content-card__description">{description}</p>

      <div className="content-card__footer">
        {stats.length > 0 && (
          <div className="content-card__stats">
            {stats.map(({ icon: StatIcon, value }) => (
              <div key={value} className="content-card__stat">
                <StatIcon size={18} strokeWidth={2} />
                <span className="content-card__stat-value">{value}</span>
              </div>
            ))}
          </div>
        )}
        {actionLabel && (
          <button
            type="button"
            className="content-card__action-btn"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}
