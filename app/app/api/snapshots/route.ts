import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
// import { Storage } from '@google-cloud/storage'; // TEMP remove
// import { db } from '@/lib/firestore'; // TEMP remove
// import type { UserData } from '@/lib/types'; // TEMP remove

// // Initialize GCS Client (outside handler for reuse)
// let storage: Storage;
// try {
//   storage = new Storage();
//   console.log('GCS client initialized successfully for /api/snapshots');
// } catch (error) {
//   console.error("Failed to initialize GCS client for /api/snapshots:", error);
// }

export async function GET() {
  console.log('GET /api/snapshots called (SUPER SIMPLIFIED)');
  
  // Return a simple static response
  return NextResponse.json({ message: 'API route exists!', snapshots: [] });
} 