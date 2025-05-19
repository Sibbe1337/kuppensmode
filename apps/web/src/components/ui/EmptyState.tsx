import React from 'react';
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  illustration?: string;
  className?: string;
  children?: React.ReactNode; // For adding buttons or other elements
}

// Placeholder SVG - Replace with actual illustration
const PlaceholderIllustration = () => (
  <svg className="h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6a1.5 1.5 0 0 1 1.5-1.5h2.25m-.75 3.75 3 3m0 0 3-3m-3 3V6m-1.5 3.75-3-3m0 0-3 3m3-3V15" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15H7.5a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3h7.5a3 3 0 0 1 3 3v4.5a3 3 0 0 1-3 3h-1.5" />
  </svg>
);


export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = <PlaceholderIllustration />,
  illustration,
  className,
  children,
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8 md:p-12 border border-dashed rounded-lg", className)}>
      <div className="mb-4">
        {illustration ? (
          <img src={illustration} alt={title} className="h-32 w-32 mx-auto mb-2" />
        ) : (
          icon
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}; 