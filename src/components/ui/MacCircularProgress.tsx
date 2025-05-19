import React from 'react';

interface MacCircularProgressProps {
  value: number; // 0-100
  size?: number; // diameter of the circle
  strokeWidth?: number;
  className?: string;
}

const MacCircularProgress: React.FC<MacCircularProgressProps> = ({
  value,
  size = 80,
  strokeWidth = 3,
  className = "",
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Ensure value is between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          className="stroke-slate-200/70 dark:stroke-slate-700/70"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress fill */}
        <circle
          className="stroke-primary transition-all duration-500 ease-out" // Adjusted transition
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold text-foreground tabular-nums">
          {Math.round(clampedValue)}%
        </span>
      </div>
    </div>
  );
};

export default MacCircularProgress; 