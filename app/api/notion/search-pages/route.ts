import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore';
import { Client as NotionClient } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

async function getUserNotionAccessToken(userId: string): Promise<string | null> {
  try {
    const integrationRef = db.collection('users').doc(userId).collection('integrations').doc('notion');
    const doc = await integrationRef.get();
    if (!doc.exists) return null;
    return doc.data()?.accessToken || null;
  } catch (error) {
    console.error(`[API SearchPages] Error fetching Notion token for user ${userId}:`, error);
    return null;
  }
}

// Helper to extract title from Notion page properties
function getPageTitle(page: PageObjectResponse): string {
    // Common title properties: 'title', 'name' (for databases often)
    // Adjust based on typical page object structure
    const titleProp = Object.values(page.properties).find(prop => prop.type === 'title');
    if (titleProp && titleProp.type === 'title' && titleProp.title[0]?.plain_text) {
        return titleProp.title[0].plain_text;
    }
    // Fallback for other potential title-like properties or if page is a DB entry used as page
    const nameProp = page.properties.Name || page.properties.name;
    if (nameProp && nameProp.type === 'title' && nameProp.title[0]?.plain_text) {
        return nameProp.title[0].plain_text;
    }
    return 'Untitled Page';
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const notionToken = await getUserNotionAccessToken(userId);
  if (!notionToken) {
    return new NextResponse(JSON.stringify({ error: "Notion integration not found or token missing." }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const notion = new NotionClient({ auth: notionToken });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || undefined; // Optional search query from client

  try {
    console.log(`[API SearchPages] User: ${userId} searching pages with query: '${query || ""}'`);
    const searchResponse = await notion.search({
      ...(query && { query }),
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 20, // Return a reasonable number for a combobox
    });

    const pages = searchResponse.results
      .filter((item): item is PageObjectResponse => item.object === 'page') // Ensure they are pages
      .map((page) => ({
        id: page.id,
        title: getPageTitle(page),
        icon: page.icon?.type === 'emoji' ? page.icon.emoji : (page.icon?.type === 'external' ? page.icon.external.url : null),
        lastEditedTime: page.last_edited_time,
      }));

    return NextResponse.json(pages);

  } catch (error: any) {
    console.error(`[API SearchPages] Error searching Notion pages for user ${userId}:`, error);
    // Check for common Notion API errors (e.g., token invalid, rate limits)
    if (error.code === 'unauthorized' || error.status === 401) {
        return new NextResponse(JSON.stringify({ error: 'Notion API Unauthorized. Please re-authenticate.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    return new NextResponse(JSON.stringify({ error: 'Failed to search Notion pages.', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
} 