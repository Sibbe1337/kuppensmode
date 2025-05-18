import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { PubSub } from '@google-cloud/pubsub';
import { getDb } from "@/lib/firestore";
import { FieldValue } from '@shared/firestore';
import { DEFAULT_USER_QUOTA } from '@/config/defaults';
import type { UserQuota } from '@/types/user'; // Corrected import for UserQuota type
import { createStorage } from '../../../packages/shared/storage';

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const TOPIC_NAME_SNAPSHOT_CREATE = process.env.PUBSUB_SNAPSHOT_TOPIC || 'notion-lifeline-snapshot-requests'; // Specific topic name
const bucketName = process.env.GCS_BUCKET_NAME;

let createSnapshotPubSubInstance: PubSub | null = null;

function getCreateSnapshotPubSubInstance(): PubSub {
  if (createSnapshotPubSubInstance) {
    return createSnapshotPubSubInstance;
  }
  let pubSubClientConfig: any = {
    ...(projectId && { projectId }),
  };
  if (keyJsonString) {
    try {
      console.log('[PubSub Lib - SnapCreate Route] Attempting to use credentials from GCP_SERVICE_ACCOUNT_KEY_JSON.');
      const credentials = JSON.parse(keyJsonString);
      pubSubClientConfig = { ...pubSubClientConfig, credentials };
    } catch (e) {
      console.error("[PubSub Lib - SnapCreate Route] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
      throw new Error("Invalid GCP Service Account Key JSON provided for PubSub (SnapCreate Route).");
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
        console.warn('[PubSub Lib - SnapCreate Route] GCP_SERVICE_ACCOUNT_KEY_JSON is NOT SET. PubSub client will initialize without explicit credentials. Operations may fail if ADC not available/configured at runtime.');
    } else {
        console.warn('[PubSub Lib - SnapCreate Route] GCP_SERVICE_ACCOUNT_KEY_JSON not set in dev. Attempting Application Default Credentials.');
    }
  }
  console.log(`[PubSub Lib - SnapCreate Route] Initializing PubSub instance for topic ${TOPIC_NAME_SNAPSHOT_CREATE}.`);
  createSnapshotPubSubInstance = new PubSub(pubSubClientConfig);
  console.log('[PubSub Lib - SnapCreate Route] PubSub instance configured.');
  return createSnapshotPubSubInstance;
}

const getCreateSnapshotPubSub = () => getCreateSnapshotPubSubInstance();

export async function POST(request: Request) {
  const db = getDb(); // Get instance here
  const pubsub = getCreateSnapshotPubSub(); // Get PubSub instance here
  const { userId } = getAuth(request as any);
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const storage = createStorage();
  const now = new Date();
  const snapshotId = `test-snapshot-${now.getTime()}`;
  const filePath = `${userId}/${snapshotId}.json.gz`;

  // Dummy content
  const content = Buffer.from(JSON.stringify({ hello: "world", created: now.toISOString() }));

  try {
    await storage.bucket(bucketName!).file(filePath).save(content, {
      gzip: true,
      metadata: { contentType: 'application/json' }
    });
    return NextResponse.json({ success: true, snapshotId });
  } catch (e) {
    return new NextResponse("Failed to create test snapshot", { status: 500 });
  }
} 