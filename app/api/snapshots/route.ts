import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server'; // Import server-side auth
// import { Storage } from '@google-cloud/storage'; // TODO: Uncomment when implementing GCS logic
import type { Snapshot } from '@/types';

// TODO: Initialize GCS Storage client (outside handler for potential reuse)
// const storage = new Storage();
// const bucketName = process.env.GCS_BUCKET_NAME || 'ntm-snapshots'; // Get bucket name from env

export async function GET(request: Request) {
  try {
    // 1. Get authenticated user ID
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log(`Fetching snapshots for user: ${userId}`);

    // 2. TODO: Implement GCS logic to list files
    // Example placeholder:
    // const [files] = await storage.bucket(bucketName).getFiles({ prefix: `${userId}/` });
    // console.log(`Found ${files.length} files for user ${userId}`);

    // 3. TODO: Parse file details into Snapshot[] format
    // Example placeholder:
    // const snapshots: Snapshot[] = files.map((file) => {
    //   // Extract details from filename (e.g., timestamp) and metadata
    //   const timestamp = file.metadata.timeCreated; // Or parse from filename
    //   const sizeKB = Math.round(Number(file.metadata.size || 0) / 1024);
    //   return {
    //     id: file.name, // Use full path or just filename as ID?
    //     timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    //     sizeKB: sizeKB,
    //     status: 'Completed', // Determine status if possible
    //   };
    // }).filter(snapshot => snapshot.id !== `${userId}/`); // Filter out the directory itself if listed
     
    // MOCK DATA for now until GCS logic is implemented
    const snapshots: Snapshot[] = [
        {
            id: `${userId}/snap_1_${Date.now() - 100000}.json.gz`,
            timestamp: new Date(Date.now() - 100000).toISOString(),
            sizeKB: 1024,
            status: "Completed",
        },
        {
            id: `${userId}/snap_2_${Date.now() - 200000}.json.gz`,
            timestamp: new Date(Date.now() - 200000).toISOString(),
            sizeKB: 2048,
            status: "Completed",
        },
    ];

    console.log(`Returning ${snapshots.length} snapshots for user ${userId}`);

    // 4. Return the list
    return NextResponse.json(snapshots);

  } catch (error) {
    console.error("Error fetching snapshots:", error);
    // Consider more specific error handling based on potential GCS errors
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 