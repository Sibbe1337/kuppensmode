import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Or 'edge' if it doesn't need Node-specific APIs

export async function GET(request: Request) {
  // In a real implementation, this would take snapshot IDs as query params,
  // fetch them, compute a diff, etc.
  // For MVP, if not in demo mode, this indicates feature is coming.

  const mockCompareData = {
    fromSnapshot: {
      id: "real_snap_prev",
      label: "Previous Snapshot (Placeholder)"
    },
    toSnapshot: {
      id: "real_snap_curr",
      label: "Current Snapshot (Placeholder)"
    },
    availableSnapshots: [
      { id: "real_snap_prev", label: "Previous Snapshot (Placeholder)" },
      { id: "real_snap_curr", label: "Current Snapshot (Placeholder)" },
    ],
    analysisComplete: false,
    confidenceScore: 0,
    added: 0,
    modified: 0,
    removed: 0,
    message: "Snapshot comparison feature is under development. Data shown is placeholder."
  };

  return NextResponse.json(mockCompareData);
} 