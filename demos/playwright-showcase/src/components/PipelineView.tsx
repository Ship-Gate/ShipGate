import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Circle } from 'lucide-react';

export type StepStatus = 'pending' | 'running' | 'pass' | 'fail';

export interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

interface PipelineViewProps {
  steps: PipelineStep[];
  showGateDetail?: boolean;
  gateVerdict?: 'SHIP' | 'NO_SHIP';
  gateScore?: number;
  violations?: Array<{ ruleId: string; message: string }>;
}

export default function PipelineView({
  steps,
  showGateDetail = false,
  gateVerdict,
  gateScore,
  violations = [],
}: PipelineViewProps) {
  return (
    <div className="glass-card p-6" data-testid="pipeline-view">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-mono text-white/70 uppercase tracking-wider">CI / CD Pipeline</span>
        <span className="text-white/60">•</span>
        <span className="text-sm text-white/80">PR #142</span>
      </div>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-4 py-2 px-4 rounded-lg border ${
              step.status === 'fail'
                ? 'border-red-200 bg-red-50/50'
                : step.status === 'pass'
                ? 'border-green-200 bg-green-50/30'
                : step.status === 'running'
                ? 'border-cyan-200 bg-cyan-50/30'
                : 'border-white/20 bg-white/5'
            }`}
          >
            <span className="w-6 h-6 flex items-center justify-center shrink-0">
              {step.status === 'pass' && <CheckCircle className="text-green-500" size={20} />}
              {step.status === 'fail' && <XCircle className="text-red-500" size={20} />}
              {step.status === 'running' && <Loader2 className="text-cyan-500 animate-spin" size={20} />}
              {step.status === 'pending' && <Circle className="text-white/50" size={20} />}
            </span>
            <span className="font-medium text-white">{step.label}</span>
            {step.detail && (
              <span className="text-sm text-white/70 ml-auto font-mono">{step.detail}</span>
            )}
          </motion.div>
        ))}
      </div>
      {showGateDetail && gateVerdict && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 p-4 rounded-lg border-2 ${
            gateVerdict === 'NO_SHIP'
              ? 'border-red-300 bg-red-50'
              : 'border-green-300 bg-green-50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            {gateVerdict === 'NO_SHIP' ? (
              <XCircle className="text-red-600" size={24} />
            ) : (
              <CheckCircle className="text-green-600" size={24} />
            )}
            <span
              className={`text-lg font-bold ${
                gateVerdict === 'NO_SHIP' ? 'text-red-700' : 'text-green-700'
              }`}
            >
              {gateVerdict}
            </span>
            {gateScore !== undefined && (
              <span className="text-sm text-white/80">Score: {gateScore}/100</span>
            )}
          </div>
          {violations.length > 0 && (
            <ul className="text-sm text-red-800 space-y-1 mt-2">
              {violations.map((v, i) => (
                <li key={i} className="font-mono">
                  • {v.ruleId}: {v.message}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
}
