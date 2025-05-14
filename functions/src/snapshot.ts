import { cloudEvent, CloudEvent } from '@google-cloud/functions-framework';
import { Message } from '@google-cloud/pubsub';
import { db } from './lib/firestore';
import { Timestamp } from '@google-cloud/firestore';
import { Client as NotionClient } from '@notionhq/client';
import { OpenAIEmbeddings } from "@langchain/openai"; // For embeddings
import { Pinecone } from '@pinecone-database/pinecone';    // For vector storage
import PQueue from 'p-queue';
import { promisify } from 'util';
import zlib from 'node:zlib';
import { Storage } from '@google-cloud/storage';
// import type { UserData } from './lib/types'; // Keep commented out for now

const gunzip = promisify(zlib.gunzip);
const gzip = promisify(zlib.gzip);

// Initialize clients outside the handler for potential reuse across invocations
let notion: NotionClient;
let storage: Storage;
let openaiEmbeddings: OpenAIEmbeddings;
let pinecone: Pinecone;

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const NOTION_API_KEY_SECRET_NAME = 'NOTION_API_KEY'; // Name of the env var set by Cloud Functions
const OPENAI_API_KEY_SECRET_NAME = 'OPENAI_API_KEY';
const PINECONE_API_KEY_SECRET_NAME = 'PINECONE_API_KEY';
const PINECONE_INDEX_NAME_SECRET_NAME = 'PINECONE_INDEX_NAME';

async function initializeClients(userId?: string) {
  if (!GCS_BUCKET_NAME) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set.');
  }
  storage = new Storage();

  // For Notion, if we need a user-specific token, this will need to be fetched.
  // For now, assuming a global NOTION_API_KEY from env for initial setup.
  const notionApiKey = process.env[NOTION_API_KEY_SECRET_NAME];
  if (!notionApiKey) throw new Error(`${NOTION_API_KEY_SECRET_NAME} not set in environment variables.`);
  notion = new NotionClient({ auth: notionApiKey });

  const openaiApiKey = process.env[OPENAI_API_KEY_SECRET_NAME];
  if (!openaiApiKey) throw new Error(`${OPENAI_API_KEY_SECRET_NAME} not set in environment variables.`);
  openaiEmbeddings = new OpenAIEmbeddings({ openAIApiKey: openaiApiKey, modelName: "text-embedding-3-small" });

  const pineconeApiKey = process.env[PINECONE_API_KEY_SECRET_NAME];
  if (!pineconeApiKey) throw new Error(`${PINECONE_API_KEY_SECRET_NAME} not set in environment variables.`);
  pinecone = new Pinecone({ apiKey: pineconeApiKey });

  console.log('All clients initialized successfully.');
}

export const snapshotTrigger = cloudEvent(
  'snapshotTrigger',
  async (cloudEvent: CloudEvent<Message>) => {
    const mainFunctionName = 'snapshotTrigger';
    console.log(`${mainFunctionName}: Received event: ${cloudEvent.id}`);

    if (!cloudEvent.data?.data) {
      console.error(`${mainFunctionName}: No data in Pub/Sub message.`);
      return; // Acknowledge the message to prevent retries for malformed ones
    }

    let messagePayload: any;
    try {
      // When publishing a string message via gcloud, cloudEvent.data.data is a Buffer of the UTF8 string.
      const jsonString = (cloudEvent.data.data as Buffer).toString('utf8');
      messagePayload = JSON.parse(jsonString);
      console.log(`${mainFunctionName}: Decoded message payload:`, messagePayload);
    } catch (e: any) {
      console.error(`${mainFunctionName}: Failed to decode/parse Pub/Sub message data:`, e);
      return; // Acknowledge message
    }

    try {
      // Ensure clients are initialized (idempotent)
      // Pass userId if available from payload and needed for user-specific client init (e.g. Notion token from DB)
      await initializeClients(messagePayload.userId); 

      console.log(`${mainFunctionName}: Placeholder - Snapshot logic would run here with payload:`, messagePayload);
      // TODO: Implement actual snapshot logic based on messagePayload
      // e.g., determine scope (all users, specific user, specific page)
      // fetch Notion data, process, store to GCS, store embeddings to Pinecone, update Firestore.

      // Example: if (messagePayload.task === 'trigger-all-snapshots-dev') { ... }
      // Example: if (messagePayload.userId && messagePayload.pageId) { ... }

      console.log(`${mainFunctionName}: Placeholder - Main logic executed successfully for event ${cloudEvent.id}.`);

    } catch (e: any) {
      console.error(`${mainFunctionName} failed for event ${cloudEvent.id}:`, e);
      // Consider updating a Firestore job/status document here if applicable
    }
  }
); 