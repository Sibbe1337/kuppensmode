"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertTriangle, Sparkles, Lightbulb, Info, Zap, Loader2 } from 'lucide-react';
import MacCircularProgress from '@/components/ui/MacCircularProgress';

// Define potential states for the component
type AnalysisStatus = 'loading' | 'error' | 'success' | 'empty';

interface LatestAnalysisProps {
  status?: AnalysisStatus;
  similarityScore?: number;
  confidence?: string;
  systemStatus?: string;
  aiInsights?: Array<{ id: string; text: string; iconName: keyof typeof iconComponents }>;
  errorMessage?: string;
}

const iconComponents = {
  Lightbulb,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Info,
  Zap,
  Loader2
};

const LatestAnalysis: React.FC<LatestAnalysisProps> = ({
  status = 'success', // Default to success for existing dummy data logic
  similarityScore = 87, // Default dummy data
  confidence = "High confidence", // Default dummy data
  systemStatus = "All systems normal", // Default dummy data
  aiInsights = [
    { id: 'insight1', text: "Recommend checking metadata changes in 'Project Phoenix' database.", iconName: 'Lightbulb' },
    { id: 'insight2', text: "Consider archiving 3 older pages not updated in 6 months.", iconName: 'Sparkles' },
  ], // Default dummy data
  errorMessage = "Could not load analysis data."
}) => {

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center h-full py-10">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground mt-3">Loading Analysis...</p>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center text-center h-full py-10">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-3" />
            <h4 className="font-semibold text-foreground mb-1">Analysis Failed</h4>
            <p className="text-sm text-muted-foreground px-4">{errorMessage}</p>
            {/* Optional: Add a retry button here */}
          </div>
        );
      case 'empty':
        return (
          <div className="flex flex-col items-center justify-center text-center h-full py-10">
            <Info className="h-12 w-12 text-muted-foreground/60 mb-3" />
            <h4 className="font-semibold text-foreground mb-1">No Analysis Yet</h4>
            <p className="text-sm text-muted-foreground px-4">
              Compare two snapshots to see AI-powered insights here.
            </p>
          </div>
        );
      case 'success':
        const IconComponent = aiInsights.length > 0 && iconComponents[aiInsights[0].iconName] ? iconComponents[aiInsights[0].iconName] : Lightbulb;
  return (
          <>
            <div className="text-center pt-2">
              {similarityScore !== undefined && <MacCircularProgress value={similarityScore} size={96} strokeWidth={5} />}
              {confidence && (
          <Badge 
            variant={"outline"}
                  className="mt-3 bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-800/50 dark:text-sky-300 dark:border-sky-700/80 px-2.5 py-1 text-xs font-medium"
          >
            {confidence}
          </Badge>
              )}
              {systemStatus && <p className="text-xs text-muted-foreground mt-2">{systemStatus}</p>}
        </div>

            {aiInsights && aiInsights.length > 0 && (
              <>
                <Separator className="my-4 border-t border-slate-200/60 dark:border-slate-700/60" />
        <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2.5">AI Insights</h4>
                  <ul className="space-y-2">
                    {aiInsights.map(insight => {
                      const InsightIcon = iconComponents[insight.iconName] || Lightbulb;
                      return (
                        <li key={insight.id} className="flex items-start gap-x-2.5">
                          <InsightIcon className="h-4 w-4 mr-1 mt-0.5 text-primary flex-shrink-0" />
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{insight.text}</p>
              </li>
                      );
                    })}
          </ul>
        </div>
              </>
            )}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-[280px] sm:max-w-xs lg:max-w-[270px] h-full shadow-lg rounded-xl 
                   bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-lg 
                   border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-center">Latest Analysis</CardTitle>
      </CardHeader>
      <CardContent className="text-sm pb-4 px-4">
        {renderContent()}
      </CardContent>
    </Card>
  );
};

export default LatestAnalysis; 