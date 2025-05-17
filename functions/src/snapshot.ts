import { cloudEvent, CloudEvent } from '@google-cloud/functions-framework';
import { Message } from '@google-cloud/pubsub';
import { db } from './lib/firestore';
import { Timestamp } from '@google-cloud/firestore';
import { Client as NotionClient } from '@notionhq/client';
import type { 
  SearchParameters, 
  SearchResponse, 
  PageObjectResponse, 
  DatabaseObjectResponse 
  // Add other Notion types like PageObjectResponse, DatabaseObjectResponse, BlockObjectResponse as needed
} from "@notionhq/client/build/src/api-endpoints";
import { OpenAIEmbeddings } from "@langchain/openai"; // For embeddings
import { Pinecone } from '@pinecone-database/pinecone';    // For vector storage
import PQueue from 'p-queue';
import { Storage } from '@google-cloud/storage';
// import type { UserData } from './lib/types'; // Keep commented out for now

// Global clients - some might be initialized per-function call if user-specific
let storage: Storage;
let globalNotionClient: NotionClient; // For app-level operations if any, or as a fallback
let openaiEmbeddings: OpenAIEmbeddings;
let pinecone: Pinecone;
let pineconeIndexName: string;

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
// Environment variable names for secrets (runtime injects actual values)
const NOTION_API_KEY_ENV_VAR = 'NOTION_API_KEY';
const OPENAI_API_KEY_ENV_VAR = 'OPENAI_API_KEY';
const PINECONE_API_KEY_ENV_VAR = 'PINECONE_API_KEY';
const PINECONE_INDEX_NAME_ENV_VAR = 'PINECONE_INDEX_NAME';

async function initializeGlobalClients() {
  if (!GCS_BUCKET_NAME) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set.');
  }
  if (!storage) storage = new Storage();

  const notionApiKey = process.env[NOTION_API_KEY_ENV_VAR];
  if (!notionApiKey) console.warn(`${NOTION_API_KEY_ENV_VAR} not set in environment variables. Global Notion client not initialized.`);
  else if (!globalNotionClient) globalNotionClient = new NotionClient({ auth: notionApiKey });

  const openaiApiKey = process.env[OPENAI_API_KEY_ENV_VAR];
  if (!openaiApiKey) throw new Error(`${OPENAI_API_KEY_ENV_VAR} not set in environment variables.`);
  openaiEmbeddings ??= new OpenAIEmbeddings({ openAIApiKey: openaiApiKey, modelName: "text-embedding-3-small" });
  const pineconeApiKey = process.env[PINECONE_API_KEY_ENV_VAR];
  if (!pineconeApiKey) throw new Error(`${PINECONE_API_KEY_ENV_VAR} not set in environment variables.`);
  if (!pinecone) pinecone = new Pinecone({ apiKey: pineconeApiKey });
  
  pineconeIndexName = process.env[PINECONE_INDEX_NAME_ENV_VAR] as string;
  if (!pineconeIndexName) throw new Error(`${PINECONE_INDEX_NAME_ENV_VAR} not set in environment variables.`);

  console.log('Global clients (Storage, OpenAI, Pinecone) initialized. Global Notion client may be initialized.');
}

interface SnapshotMessagePayload {
  userId?: string;
  pageId?: string; // For snapshotting a single page
  workspaceId?: string; // For snapshotting an entire workspace (if applicable)
  task?: string; // e.g., 'trigger-all-snapshots-dev', 'snapshot-user-workspace', 'snapshot-page'
  // Add other relevant fields
}

export const snapshotTrigger = cloudEvent(
  'snapshotTrigger',
  async (cloudEvent: CloudEvent<Message>) => {
    const mainFunctionName = 'snapshotTrigger';
    const eventId = cloudEvent.id;
    console.log(`${mainFunctionName}: Received event: ${eventId}`);
    
    console.log(`${mainFunctionName}: cloudEvent.data (raw):`, JSON.stringify(cloudEvent.data));

    // Extract the base64 encoded string data from the nested message property
    let base64EncodedData: string | undefined = undefined;
    if (cloudEvent.data && typeof cloudEvent.data === 'object' && 'message' in cloudEvent.data) {
      const pubSubMessageObject = (cloudEvent.data as { message?: { data?: string } }).message;
      base64EncodedData = pubSubMessageObject?.data;
    }

    console.log(`${mainFunctionName}: Extracted base64EncodedData:`, base64EncodedData);
    console.log(`${mainFunctionName}: Type of base64EncodedData:`, typeof base64EncodedData);

    if (typeof base64EncodedData !== 'string' || base64EncodedData.length === 0) {
      console.error(`${mainFunctionName}: No valid base64 string data in Pub/Sub message for event ${eventId}. Found:`, base64EncodedData);
      return; 
    }

    let messagePayload: SnapshotMessagePayload;
    try {
      const jsonString = Buffer.from(base64EncodedData, 'base64').toString('utf8');
      messagePayload = JSON.parse(jsonString) as SnapshotMessagePayload;
      console.log(`${mainFunctionName}: Decoded message payload for event ${eventId}:`, messagePayload);
    } catch (e: unknown) {
      console.error(`${mainFunctionName}: Failed to decode/parse Pub/Sub message data for event ${eventId}:`, e);
      return; 
    }

    try {
      await initializeGlobalClients();

      const { userId, pageId, task } = messagePayload;

      if (!userId && task !== 'trigger-all-snapshots-dev') { // 'trigger-all-snapshots-dev' might imply iterating all users
        console.error(`${mainFunctionName}: userId is required in message payload for most tasks. Event ${eventId}. Payload:`, messagePayload);
        // Potentially update a job status in Firestore to FAILED if a job ID was part of the payload
        return;
      }
      
      let userNotionClient: NotionClient;

      if (userId) {
        const userDocRef = db.collection('users').doc(userId);
        const userDocSnap = await userDocRef.get();

        if (!userDocSnap.exists) {
          console.error(`${mainFunctionName}: User document not found for userId: ${userId}. Event ${eventId}.`);
          return;
        }
        const userData = userDocSnap.data();
        const userNotionToken = userData?.notionAccessToken || userData?.accessToken; // Check common field names

        if (!userNotionToken) {
          console.error(`${mainFunctionName}: Notion access token not found for userId: ${userId}. Event ${eventId}.`);
          // Update snapshot job status to FAILED
          await db.collection('users').doc(userId).collection('audit').add({
            timestamp: Timestamp.now(),
            event_type: 'snapshot_failed',
            details: {
              reason: 'Notion access token missing.',
              messagePayload,
              eventId,
            }
          });
          return;
        }
        userNotionClient = new NotionClient({ auth: userNotionToken });
        console.log(`${mainFunctionName}: Initialized Notion client for user ${userId}. Event ${eventId}.`);
      } else if (task === 'trigger-all-snapshots-dev' && globalNotionClient) {
        // This case is more complex: would need to iterate all users, get their tokens, etc.
        // For now, if it's a generic task and we have a global client, use it (though not ideal for user data).
        console.warn(`${mainFunctionName}: Handling 'trigger-all-snapshots-dev' with global Notion client. This needs refinement for multi-user. Event ${eventId}.`);
        userNotionClient = globalNotionClient; 
      } else {
        console.error(`${mainFunctionName}: Cannot proceed without a userId or a valid global task handler. Event ${eventId}.`);
        return;
      }

      // --- List Pages/Databases (Notion Search API) ---
      // This is a generic search, you might want more specific logic (e.g. only "top-level" pages/DBs)
      // or iterate through a list of known root pages for the user if stored in their userDoc.
      console.log(`${mainFunctionName}: Searching Notion content for user ${userId || 'global (dev task)'}... Event ${eventId}.`);
      const notionSearchQueue = new PQueue({ concurrency: 1 }); // Notion API rate limits are strict (avg 3 req/s)
      
      let notionSearchResults: (SearchResponse['results'][0])[] = [];
      let nextCursor: string | undefined = undefined;
      
      // Example: Limiting to a few iterations for now to prevent excessive calls during dev
      let searchIterations = 0;
      const MAX_SEARCH_ITERATIONS = 5; // Adjust as needed

      do {
        if (searchIterations >= MAX_SEARCH_ITERATIONS) {
            console.warn(`${mainFunctionName}: Reached max search iterations (${MAX_SEARCH_ITERATIONS}) for user ${userId || 'global (dev task)'}. Event ${eventId}.`)
            break;
        }
        const searchParams: SearchParameters = {
          query: pageId ?? '', // If pageId is provided, search for that. Otherwise, it's an empty query (list all accessible).
          sort: {
            direction: 'ascending',
            timestamp: 'last_edited_time',
          },
          start_cursor: nextCursor,
          page_size: 20, // Max 100, keep small for now
        };
        // If snapshotting a whole workspace, an empty query lists top-level content.
        // If specific pageId, Notion's search might not be the best; direct page/block fetching is better.
        // This part needs to be adapted based on the exact snapshot scope (single page, workspace, specific DBs).

        console.log(`${mainFunctionName}: Querying Notion with params:`, searchParams);
        const response = await notionSearchQueue.add<SearchResponse>(async () => {
          return userNotionClient.search(searchParams);
        });
        
        if (!response) { // Handle case where queue might return undefined (e.g. if cleared before execution)
          throw new Error('Notion search operation did not return a response from the queue.');
        }

        notionSearchResults = notionSearchResults.concat(response.results);
        nextCursor = response.next_cursor ?? undefined;
        searchIterations++;
        console.log(`${mainFunctionName}: Found ${response.results.length} items. Has more: ${response.has_more}. Iteration: ${searchIterations}. Event ${eventId}.`);

      } while (nextCursor);

      console.log(`${mainFunctionName}: Total Notion items found for user ${userId || 'global (dev task)'}: ${notionSearchResults.length}. Event ${eventId}.`);
      
      for (const item of notionSearchResults) {
        if (item.object === 'page') {
          const page = item as PageObjectResponse;
          // Find the property of type 'title' and ensure it has a 'title' array
          const titlePropRaw = Object.values(page.properties).find(
            (prop) => prop.type === 'title' && 'title' in prop && Array.isArray((prop as { title?: unknown }).title)
          );
          const titleProp = titlePropRaw as undefined | { type: 'title'; title: Array<{ plain_text?: string }> };
          const title = titleProp && titleProp.title[0]?.plain_text
            ? titleProp.title[0].plain_text
            : 'N/A';
          console.log(`  - Page: ${page.id} (Title: ${title})`);
        } else if (item.object === 'database') {
          const database = item as DatabaseObjectResponse;
          const title = Array.isArray(database.title) && database.title[0]?.plain_text
            ? database.title[0].plain_text
            : 'N/A';
          // TODO: Query database rows, fetch blocks for each row, process, embed, store
          console.log(`  - Database: ${database.id} (Title: ${title})`);
        }
      }
      
      // TODO: Store snapshot metadata in Firestore.
      console.log(`${mainFunctionName}: Placeholder - Main logic executed successfully for event ${eventId}.`);

    } catch (e: unknown) {
      console.error(`${mainFunctionName}: Processing failed for event ${eventId}:`, e);
      // Potentially update a job status in Firestore to FAILED if a job ID was part of the payload
    }
  }
); 