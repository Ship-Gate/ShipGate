import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
}

export default function StepIndicator({
  steps,
  currentStep,
  completedSteps,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2" data-testid="step-indicator">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(index);
        const isCurrent = currentStep === index;
        const isPending = !isCompleted && !isCurrent;

        return (
          <div key={step.id} className="flex items-center">
            <motion.div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                isCurrent
                  ? 'bg-cyan-50 border border-cyan-300'
                  : isCompleted
                  ? 'bg-green-50 border border-green-300'
                  : 'bg-gray-50 border border-gray-200'
              }`}
              initial={false}
              animate={{
                scale: isCurrent ? 1.02 : 1,
              }}
              data-testid={`step-${step.id}`}
              data-status={isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isCompleted ? (
                  <Check size={14} />
                ) : isCurrent ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  index + 1
                )}
              </div>
              <div>
                <span
                  className={`text-sm font-medium ${
                    isPending ? 'text-gray-400' : 'text-gray-700'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </motion.div>
            {index < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
