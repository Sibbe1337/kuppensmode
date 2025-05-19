import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { getDb } from '@/lib/firestore'; // For any potential metadata fetching if needed
import { env } from '@notion-lifeline/config';

export const runtime = 'nodejs';

interface AskDiffRequestBody {
  snapshotIdFrom: string;
  snapshotIdTo: string;
  question: string;
  // diffJobId?: string; // Optional: For future optimization
}

// === Initialize Clients (Lazy Load or Module Scope with Checks) ===
// OpenAI
let openaiClient: OpenAI | null = null;
if (env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  console.log("[API AskDiff] OpenAI client initialized.");
} else {
  console.warn("[API AskDiff] OPENAI_API_KEY not set. This API will not function.");
}

// Pinecone
let pineconeClient: Pinecone | null = null;
let pineconeIndexName: string | null = null;
if (env.PINECONE_API_KEY && env.PINECONE_INDEX_NAME) {
  pineconeClient = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  pineconeIndexName = env.PINECONE_INDEX_NAME;
  console.log(`[API AskDiff] Pinecone client initialized for index: ${pineconeIndexName}`);
} else {
  console.warn("[API AskDiff] Pinecone API Key or Index Name not set. This API will not function.");
}

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'; // Same as snapshot-worker

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!openaiClient || !pineconeClient || !pineconeIndexName) {
    console.error("[API AskDiff] OpenAI or Pinecone client not initialized due to missing config.");
    return NextResponse.json({ error: 'Server configuration error: AI clients not initialized.' }, { status: 500 });
  }

  let body: AskDiffRequestBody;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { snapshotIdFrom, snapshotIdTo, question } = body;

  if (!snapshotIdFrom || !snapshotIdTo || !question) {
    return NextResponse.json({ error: 'Missing snapshotIdFrom, snapshotIdTo, or question' }, { status: 400 });
  }

  console.log(`[API AskDiff] User: ${userId} asked: "${question}" about diff ${snapshotIdFrom} <-> ${snapshotIdTo}`);

  try {
    // 1. Generate embedding for the user's question
    const questionEmbeddingResponse = await openaiClient.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: question,
    });
    const questionEmbedding = questionEmbeddingResponse.data[0]?.embedding;

    if (!questionEmbedding) {
      console.error("[API AskDiff] Failed to generate embedding for the question.");
      return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
    }

    // 2. Query Pinecone
    // We need to query against the user's namespace.
    // And potentially filter by snapshotIdFrom OR snapshotIdTo if possible, or just query broadly in user's namespace.
    const index = pineconeClient.index(pineconeIndexName);
    const userNamespace = index.namespace(userId); // Query within the user's namespace

    const queryResponse = await userNamespace.query({
      vector: questionEmbedding,
      topK: 5, // Fetch top 5 most relevant chunks/titles
      // TODO: How to best filter for items related to snapshotIdFrom OR snapshotIdTo?
      // Pinecone metadata filtering can be complex with OR conditions on different fields.
      // For now, querying broadly in the user's namespace and relying on semantic relevance.
      // We could also include snapshotId in metadata of vectors if not already there explicitly for filtering.
      // The current vector IDs are like `${snapshotId}:${itemId}:type`
      // The metadata has `snapshotId` field.
      filter: {
        $or: [
          { snapshotId: { $eq: snapshotIdFrom } },
          { snapshotId: { $eq: snapshotIdTo } }
        ]
      },
      includeMetadata: true,
    });

    let contextText = "";
    if (queryResponse.matches && queryResponse.matches.length > 0) {
      contextText = queryResponse.matches.map(match => {
        let text = match.metadata?.originalText || match.metadata?.originalTextSnippet || '';
        return `Relevant snippet (from snapshot ${match.metadata?.snapshotId}, item ${match.metadata?.itemId}, type ${match.metadata?.itemType}):\n${text}`;
      }).join('\n\n---\n\n');
    } else {
      contextText = "No specific text snippets found directly matching your question in the changed content.";
    }

    // 3. Construct prompt for LLM
    const systemMessage = "You are a helpful AI assistant. Answer the user's question based on the provided context about changes that occurred between two versions of their Notion workspace. If the context doesn't fully answer, say so clearly. Be concise.";
    const userPrompt = `
Context from the Notion workspace changes:
"""
${contextText}
"""

User's Question: ${question}

Answer:
    `.trim();

    // 4. Call LLM (OpenAI Chat Completion)
    const chatCompletion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const answer = chatCompletion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate an answer.";

    return NextResponse.json({ answer });

  } catch (error: any) {
    console.error("[API AskDiff] Error processing request:", error);
    // Check for specific Pinecone or OpenAI errors if needed
    return NextResponse.json({ error: 'Failed to get answer from AI.', details: error.message }, { status: 500 });
  }
} 