import OpenAI from 'openai';
// import type { SemanticDiffResult, ChangedItemDetail } from '@/types/diff'; // Adjust path if needed based on final location

// Define types locally if import is removed
interface ChangedItemDetail {
  id: string;
  name?: string;
  itemType?: string;
  blockType?: string;
  changeType: string; // Simplified for now
  similarityScore?: number;
}

interface SemanticDiffResult {
  summary: {
    added: number;
    deleted: number;
    contentHashChanged: number;
    semanticallySimilar: number;
    semanticallyChanged: number;
  };
  details?: {
    changedItems?: ChangedItemDetail[];
  };
}

// This function expects an initialized OpenAI client to be available.
// It could be passed as an argument, or this module could initialize its own.
// For now, assuming it's available in the scope where this is imported and used,
// or that `openaiClient` below is globally/module-level initialized in the main worker file.

// Placeholder for where the client would be defined if not passed in.
// This should align with how openaiClient is managed in diff-worker/index.ts
let openaiClient: OpenAI;

// Call this function in diff-worker/index.ts to set the client instance from there
export function initOpenAIUtils(client: OpenAI) {
    openaiClient = client;
}

export async function generateDiffSummary(
  diff: SemanticDiffResult
): Promise<{ text: string; tokens: number; modelUsed: string }> {
  if (!openaiClient) {
    console.warn('[OpenAIUtils] OpenAI client not initialized. Skipping summary generation.');
    return { text: 'OpenAI client not available to generate summary.', tokens: 0, modelUsed: 'none' };
  }

  const { summary, details } = diff;

  // Ensure details and changedItems are not undefined
  const changedItems = details?.changedItems || [];

  const topChanges = changedItems
    .filter(d => {
      // Define what constitutes "Minor" - for now, let's exclude 'hash_only_similar' if score is very high
      // or items with no embeddings found, or pending checks, if they are not considered significant.
      // This filtering can be refined.
      if (d.changeType === 'hash_only_similar' && (d.similarityScore || 0) >= 0.99) return false; // Very similar, less significant
      if (['pending_semantic_check', 'no_embeddings_found', 'error_in_processing'].includes(d.changeType)) return false;
      return true;
    })
    .slice(0, 10)
    .map(d => `• ${d.itemType || 'Item'} "${d.name || 'Unnamed'}" — ${d.changeType.replace(/_/g, ' ')} (Similarity: ${d.similarityScore !== undefined ? (d.similarityScore * 100).toFixed(0) + '%' : 'N/A'})`)
    .join('\n');

  const systemMessage = `You are an expert Notion workspace analyst. Your goal is to provide a concise, insightful, and helpful summary of changes between two snapshots of a user's workspace. Focus on what would be most relevant to a user trying to understand what happened.`;
  
  const userPrompt = `
Based on the following changes between two snapshots of a Notion workspace, please provide a summary.

Key Statistics:
- Items Added: ${summary.added}
- Items Deleted: ${summary.deleted}
- Items Modified (content hash changed): ${summary.contentHashChanged}
  - Of these modified items, ${summary.semanticallySimilar} were found to be semantically similar to their previous version.
  - And ${summary.semanticallyChanged} were found to have significant semantic differences from their previous version.

${topChanges.length > 0 ? 'Highlights of Modified Items (up to 10 shown):\n' + topChanges : 'No specific modified items highlighted due to similarity or lack of detailed changes available.'}

Please provide a crisp 3-sentence summary of the most important changes, followed by up to 3 actionable bullet-point recommendations or observations for the user.
Format your response clearly with "Summary:" and "Recommendations:" headings.
`.trim();

  const modelToUse = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

  try {
    const completion = await openaiClient.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user',   content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 250, // Add a max_tokens limit for the summary
    });

    return {
      text: completion.choices[0]?.message?.content?.trim() || 'Could not generate summary.',
      tokens: completion.usage?.total_tokens ?? 0,
      modelUsed: modelToUse
    };
  } catch (error) {
    console.error('[OpenAIUtils] Error generating diff summary with OpenAI:', error);
    return { text: 'Error generating summary.', tokens: 0, modelUsed: modelToUse };
  }
} 