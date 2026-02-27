import React from "react";

interface ProblemBoxProps {
  children: React.ReactNode;
  className?: string;
}

export default function ProblemBox({ children, className = "" }: ProblemBoxProps) {
  return (
    <div className={`problem-box ${className}`}>
      {children}
    </div>
  );
}
