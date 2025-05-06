import { http, Request, Response } from '@google-cloud/functions-framework'; // Use named http export
import { db } from './lib/firestore'; // Corrected path
import { getSecret } from './lib/secrets'; // Corrected path
import { verifyToken } from '@clerk/backend';
import { Timestamp } from '@google-cloud/firestore';
// import type { UserData } from './lib/types'; // Removed problematic import
import { Storage } from '@google-cloud/storage';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { Client as NotionClient, isFullBlock } from '@notionhq/client';
import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

// Promisify zlib.gunzip for async usage
const gunzip = promisify(zlib.gunzip);

// Initialize GCS Client (outside the handler for potential reuse)
let storage: Storage;
try {
  storage = new Storage();
  console.log('GCS client initialized successfully for restore function.');
} catch (error) {
  console.error("Failed to initialize GCS client:", error);
}

interface RestoreRequestBody {
  pageId: string;
  timestamp: string; // Expect ISO timestamp string e.g., 2023-10-27T10:30:00.000Z
}

/**
 * HTTP Cloud Function to restore a specific Notion page from a snapshot.
 */
export const restoreTrigger = http('restoreTrigger', async (req: Request, res: Response) => {
  console.log(`Received restore request for page: ${req.body?.pageId} at timestamp: ${req.body?.timestamp}`);

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { pageId, timestamp } = req.body as RestoreRequestBody;
    if (!pageId || !timestamp) {
      res.status(400).send('Missing pageId or timestamp in request body');
      return;
    }

    // 1. Verify Clerk JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('Authorization header missing or invalid format');
      res.status(401).send('Unauthorized: Missing or invalid token format');
      return;
    }
    const token = authHeader.split(' ')[1];

    let authResult: any;
    let userId: string | null = null;
    try {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY || await getSecret('CLERK_SECRET_KEY');
      if (!clerkSecretKey) throw new Error('CLERK_SECRET_KEY not configured.');
      
      authResult = await verifyToken(token, {
        secretKey: clerkSecretKey,
      });
      userId = authResult.sub;
      if (!userId) {
          throw new Error('Invalid token payload: Missing sub (userId)');
      }
    } catch (error: any) {
      console.warn('Token verification failed:', error.message);
      res.status(401).send(`Unauthorized: ${error.message}`);
      return;
    }
    console.log(`Request authorized for user: ${userId}`);

    // 2. Query Firestore for user plan and Notion accessToken
    const userDocRef = db.collection('users').doc(userId);
    
    const userDocSnap = await userDocRef.get();
    const userData = userDocSnap.data(); // Rely on inference or use Record<string, any>

    if (!userData) {
      console.error(`User data is unexpectedly missing for userId: ${userId}, though document should exist.`);
      res.status(404).send('User data not found or is empty.');
      return;
    }

    // Assuming userData contains these fields. Consider defining a UserData type for better safety.
    const notionAccessToken = userData.notionAccessToken;
    const plan = userData.plan;
    const userBucket = userData.bucket || 'ntm-snapshots'; 
    console.log(`Fetched user data for ${userId}. Plan: ${plan}`);

    // --- ENFORCE LIMITS ---
    if (plan === 'free') {
      console.log('User is on free plan, checking snapshot age...');
      try {
        const snapshotDate = new Date(timestamp);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        if (snapshotDate < sevenDaysAgo) {
          console.warn(`Restore blocked for user ${userId}: Snapshot timestamp ${timestamp} is older than 7 days.`);
          res.status(403).send('Forbidden: Free plan users can only restore snapshots from the last 7 days.');
          return;
        }
        console.log('Snapshot age check passed for free user.');
      } catch (dateError) {
        console.error('Error parsing snapshot timestamp:', timestamp, dateError);
        res.status(400).send('Invalid timestamp format provided.');
        return;
      }
    }
    // --- LIMITS ENFORCED ---

    // 4. Create initial job document in `restores` collection (status: 'QUEUED')
    const restoreJobRef = db.collection('restores').doc();
    const restoreJobId = restoreJobRef.id;
    await restoreJobRef.set({
      userId: userId,
      pageId: pageId,
      gcsTimestamp: timestamp,
      status: 'QUEUED',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`Created restore job ${restoreJobId} for user ${userId}, page ${pageId}`);

    // --- Background processing starts here ---
    try {
        await restoreJobRef.update({ status: 'PROCESSING', updatedAt: Timestamp.now() });

        // 5. Retrieve snapshot from GCS
        const snapshotPath = `${userId}/${pageId}-${timestamp}.json.gz`; 
        console.log(`Retrieving snapshot: gs://${userBucket}/${snapshotPath}`);
        if (!storage) throw new Error('GCS Storage client not initialized');
        const file = storage.bucket(userBucket).file(snapshotPath);
        const [exists] = await file.exists();
        if (!exists) {
            throw new Error(`Snapshot file not found: ${snapshotPath}`);
        }
        const [compressedSnapshotDataBuffer] = await file.download();
        console.log(`Downloaded snapshot file: ${compressedSnapshotDataBuffer.length} bytes.`);

        // 6. Decompress/parse snapshot
        console.log('Decompressing snapshot...');
        const decompressedData = await gunzip(compressedSnapshotDataBuffer);
        const snapshotJson = JSON.parse(decompressedData.toString('utf8'));
        console.log(`Decompressed snapshot successfully. Found ${Array.isArray(snapshotJson) ? snapshotJson.length : 'N/A'} items/blocks.`);

        // 7. Use @notionhq/client to patch Notion page blocks
        if (!notionAccessToken) {
          throw new Error('User Notion access token not found in Firestore.');
        }
        const notion = new NotionClient({ auth: notionAccessToken });
        console.log(`Restoring page ${pageId} using Notion token...`);

        // 7.1 Fetch existing blocks (paginated)
        console.log(`Fetching existing blocks for page ${pageId}...`);
        let existingBlocks = [];
        let nextCursor: string | undefined | null = undefined;
        do {
          const response = await notion.blocks.children.list({ block_id: pageId, start_cursor: nextCursor ?? undefined });
          existingBlocks.push(...response.results);
          nextCursor = response.next_cursor;
        } while (nextCursor);
        console.log(`Found ${existingBlocks.length} existing blocks.`);

        // 7.2 Delete existing blocks
        if (existingBlocks.length > 0) {
          console.log('Deleting existing blocks...');
          await Promise.all(existingBlocks.map(block => notion.blocks.delete({ block_id: block.id })));
          console.log('Finished deleting existing blocks.');
        }

        // 7.3 Prepare New Blocks from snapshotJson
        if (!Array.isArray(snapshotJson)) {
          throw new Error('Snapshot JSON data is not an array as expected.');
        }
        console.log('Preparing blocks for appending...');
        const blocksToAppend: BlockObjectRequest[] = snapshotJson.map((block: any): BlockObjectRequest | null => {
            if (!block || typeof block !== 'object' || !block.type) {
                console.warn('Skipping invalid item in snapshot data:', block);
                return null;
            }
            const { id, created_time, created_by, last_edited_time, last_edited_by, parent, has_children, archived, ...writableBlock } = block;
            return writableBlock as BlockObjectRequest;
        }).filter((block): block is BlockObjectRequest => block !== null);

        // 7.4 Append new blocks (handle potential rate limits implicitly via client or add explicit delay/retry)
        console.log(`Appending ${blocksToAppend.length} blocks...`);
        for (let i = 0; i < blocksToAppend.length; i += 100) {
          const batch = blocksToAppend.slice(i, i + 100);
          await notion.blocks.children.append({ block_id: pageId, children: batch });
          console.log(`Appended batch ${i / 100 + 1}`);
        }
        console.log('Finished appending blocks.');

        // 8. Update job status to 'COMPLETED'
        await restoreJobRef.update({ status: 'COMPLETED', updatedAt: Timestamp.now() });
        console.log(`Restore job ${restoreJobId} completed successfully.`);
        res.status(200).send({ message: 'Restore completed successfully', jobId: restoreJobId });

    } catch (restoreError: any) {
        console.error(`Restore process failed for job ${restoreJobId}:`, restoreError);
        await restoreJobRef.update({ 
            status: 'FAILED', 
            error: restoreError.message || 'Unknown restore error', 
            updatedAt: Timestamp.now() 
        });
        res.status(500).send({ error: 'Restore process failed', details: restoreError.message });
        return;
    }

  } catch (error: any) {
    console.error('Error in restoreTrigger function:', error);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
}); 