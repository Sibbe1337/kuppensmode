"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertTriangle, Sparkles, Lightbulb } from 'lucide-react';

// Placeholder for a circular progress component
// In a real implementation, you might use a library or build a custom SVG component.
const CircularProgressPlaceholder: React.FC<{ value: number }> = ({ value }) => {
  return (
    <div className="relative w-24 h-24 mx-auto mb-2">
      <svg className="w-full h-full" viewBox="0 0 36 36">
        <path
          className="stroke-current text-slate-200 dark:text-slate-700"
          fill="none"
          strokeWidth="2"
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className="stroke-current text-primary"
          fill="none"
          strokeWidth="2"
          strokeDasharray={`${value}, 100`}
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold text-foreground">{value}%</span>
      </div>
    </div>
  );
};

interface LatestAnalysisProps {
  // Props for actual data
}

const LatestAnalysis: React.FC<LatestAnalysisProps> = () => {
  // Dummy data
  const similarityScore = 87;
  const confidence = "High confidence";
  const systemStatus = "All systems normal";
  const aiInsights = [
    { id: 'insight1', text: "Recommend checking metadata changes in 'Project Phoenix' database.", icon: Lightbulb },
    { id: 'insight2', text: "Consider archiving 3 older pages not updated in 6 months.", icon: Sparkles },
  ];

  return (
    <Card className="w-full max-w-[280px] sm:max-w-xs lg:max-w-[260px] h-full shadow-lg bg-card border-border/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Latest Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* 1. Similarity Score Gauge */}
        <div className="text-center">
          <CircularProgressPlaceholder value={similarityScore} />
          <Badge 
            variant={"outline"}
            className="bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600 px-2 py-0.5 text-xs"
          >
            {confidence}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1.5">{systemStatus}</p>
        </div>

        <Separator className="my-4 bg-border/50 dark:bg-slate-700" />

        {/* 3. AI Insights List */}
        <div>
          <h4 className="font-semibold text-foreground mb-2">AI Insights</h4>
          <ul className="space-y-2.5">
            {aiInsights.map(insight => (
              <li key={insight.id} className="flex items-start">
                <insight.icon className="h-4 w-4 mr-2.5 mt-0.5 text-primary flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-normal">{insight.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default LatestAnalysis; 