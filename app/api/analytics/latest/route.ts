import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Or 'edge' if it doesn't need Node-specific APIs

export async function GET(request: Request) {
  // In a real implementation, this would fetch latest analysis data,
  // potentially involving AI insights and similarity scores.
  // For MVP, if not in demo mode, this indicates feature is coming.

  const mockLatestData = {
    similarityScore: 0,
    confidenceText: "Analysis Pending",
    systemStatusText: "AI analysis features are under development.",
    aiInsights: [
      {
        id: "placeholder1",
        text: "Advanced AI insights will be available here soon.",
        iconName: "Info" 
      }
    ]
  };

  return NextResponse.json(mockLatestData);
} 