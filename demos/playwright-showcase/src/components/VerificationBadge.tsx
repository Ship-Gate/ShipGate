import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type Status = 'verified' | 'failed' | 'warning' | 'pending';

interface VerificationBadgeProps {
  status: Status;
  label: string;
  details?: string;
}

const statusConfig = {
  verified: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  warning: {
    icon: AlertCircle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  pending: {
    icon: AlertCircle,
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
  },
};

export default function VerificationBadge({
  status,
  label,
  details,
}: VerificationBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bg} border ${config.border}`}
      data-testid={`verification-badge-${status}`}
    >
      <Icon size={16} className={config.color} />
      <div>
        <span className={`text-sm font-medium ${config.color}`}>{label}</span>
        {details && (
          <p className="text-xs text-gray-500 mt-0.5">{details}</p>
        )}
      </div>
    </motion.div>
  );
}
