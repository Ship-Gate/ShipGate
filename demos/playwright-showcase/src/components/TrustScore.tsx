import { motion } from 'framer-motion';

interface TrustScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

export default function TrustScore({ 
  score, 
  size = 'md', 
  showLabel = true,
  animated = true 
}: TrustScoreProps) {
  const sizes = {
    sm: { width: 80, stroke: 6, fontSize: 'text-lg' },
    md: { width: 120, stroke: 8, fontSize: 'text-2xl' },
    lg: { width: 180, stroke: 10, fontSize: 'text-4xl' },
  };

  const { width, stroke, fontSize } = sizes[size];
  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (score: number) => {
    if (score >= 80) return { stroke: '#22c55e', text: 'text-trust-high' };
    if (score >= 50) return { stroke: '#f59e0b', text: 'text-trust-medium' };
    return { stroke: '#ef4444', text: 'text-trust-low' };
  };

  const { stroke: strokeColor, text: textColor } = getColor(score);

  return (
    <div className="flex flex-col items-center gap-2" data-testid="trust-score">
      <div className="relative" style={{ width, height: width }}>
        {/* Background circle */}
        <svg className="transform -rotate-90" width={width} height={width}>
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="none"
            className="text-gray-200"
          />
          {/* Score circle */}
          <motion.circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={animated ? { strokeDashoffset: circumference } : { strokeDashoffset: offset }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className={`font-bold ${fontSize} ${textColor}`}
            initial={animated ? { opacity: 0 } : { opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            data-testid="trust-score-value"
          >
            {score}%
          </motion.span>
        </div>
      </div>
      {showLabel && (
        <span className="text-sm text-gray-500">Trust Score</span>
      )}
    </div>
  );
}
