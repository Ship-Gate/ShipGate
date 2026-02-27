import type { ReactNode } from 'react';

interface ProblemBoxProps {
  children: ReactNode;
  className?: string;
}

export default function ProblemBox({ children, className = '' }: ProblemBoxProps) {
  return (
    <div
      className={`rounded-2xl border border-white/25 bg-white/10 backdrop-blur-md shadow-2xl p-8 md:p-10 ${className}`}
      role="region"
      aria-label="Problem statement"
    >
      {children}
    </div>
  );
}
