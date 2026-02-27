import { motion } from 'framer-motion';
import { XCircle, CheckCircle } from 'lucide-react';

interface GateResultProps {
  verdict: 'SHIP' | 'NO-SHIP';
  message?: string;
  animated?: boolean;
}

export default function GateResult({
  verdict,
  message,
  animated = true,
}: GateResultProps) {
  const isNoShip = verdict === 'NO-SHIP';

  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.95 } : false}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl border-2 p-6 ${
        isNoShip
          ? 'border-red-500/50 bg-red-950/30'
          : 'border-green-500/50 bg-green-950/30'
      }`}
      data-testid="gate-result"
    >
      <div className="flex items-center gap-3 mb-3">
        {isNoShip ? (
          <XCircle className="text-red-400" size={32} />
        ) : (
          <CheckCircle className="text-green-400" size={32} />
        )}
        <span
          className={`text-2xl font-bold ${
            isNoShip ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {verdict}
        </span>
      </div>
      {message && (
        <p className="text-white/90 text-sm mt-2 font-mono">{message}</p>
      )}
      <p className="text-white/70 text-xs mt-2">Trust Score: 0%</p>
    </motion.div>
  );
}
