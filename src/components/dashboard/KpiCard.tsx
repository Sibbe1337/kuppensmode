"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card"; // Using only Card and CardContent as per layout
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'; // Icons for delta

export interface KpiCardProps {
  title: string;
  value: string | number;
  delta?: string; // e.g., "+1.2%" or "-0.3%"
  subtitle: string;
  gradientPreset?: 'blue' | 'purple' | 'cyan';
  slotRight?: React.ReactNode;
  className?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  delta,
  subtitle,
  gradientPreset = 'blue',
  slotRight,
  className,
}) => {
  const isPositiveDelta = delta?.startsWith('+');
  const isNegativeDelta = delta?.startsWith('-');

  let gradientClasses = 'from-[#4F4CFF] to-[#8329FF]'; // Default to blue (Card gradient 1)
  if (gradientPreset === 'purple') {
    gradientClasses = 'from-[#5A4AF9] to-[#4F98FF]'; // Card gradient 2
  } else if (gradientPreset === 'cyan') {
    gradientClasses = 'from-cyan-500 to-blue-500'; // Custom cyan gradient
  }

  return (
    <Card className={cn("relative overflow-hidden rounded-lg shadow-md dark:shadow-none bg-card", className)}>
      {/* Gradient bar top 2px */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradientClasses}`}></div>

      {/* Delta Badge top-right */}
      {delta && (
        <Badge
          variant={isPositiveDelta ? "outline" : isNegativeDelta ? "destructive" : "secondary"}
          className={cn(
            "absolute top-3 right-3 text-xs px-2 py-0.5 font-semibold leading-none border",
            isPositiveDelta && "bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600",
            isNegativeDelta && "bg-red-100 text-red-700 border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-600",
            !(isPositiveDelta || isNegativeDelta) && "border-border"
          )}
        >
          {isPositiveDelta && <ArrowUpRight className="inline h-3 w-3 mr-0.5" />}
          {isNegativeDelta && <ArrowDownRight className="inline h-3 w-3 mr-0.5" />}
          {delta.replace('+','').replace('-','')}
        </Badge>
      )}

      <CardContent className="pt-8 pb-6 px-6 flex items-center justify-between space-x-4">
        {/* Left Col: big value + title + subtitle */}
        <div className="flex flex-col space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground leading-none">{title}</h3>
          <p className="text-3xl font-bold text-foreground leading-none tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground pt-1 leading-none">{subtitle}</p>
        </div>

        {/* Right Col: slotRight (if provided) */}
        {slotRight && (
          <div className="flex-shrink-0">
            {slotRight}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KpiCard; 