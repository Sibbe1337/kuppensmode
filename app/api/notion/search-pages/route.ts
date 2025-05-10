import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { Client as NotionClient } from '@notionhq/client';
import { getDb } from "@/lib/firestore";
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

async function getUserNotionAccessToken(userId: string): Promise<string | null> {
  const db = getDb(); // Call getDb here for this helper too for consistency
  try {
    const integrationRef = db.collection('users').doc(userId).collection('integrations').doc('notion');
    const doc = await integrationRef.get();
    if (!doc.exists) return null;
    return doc.data()?.accessToken || null;
  } catch (error) {
    console.error(`Error fetching Notion access token for user ${userId}:`, error);
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
  const db = getDb(); // Instance for the main handler
  const { userId } = getAuth(request as any);
  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return new NextResponse(JSON.stringify({ error: "Query parameter is required" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const notionToken = await getUserNotionAccessToken(userId);
    if (!notionToken) {
      return new NextResponse(JSON.stringify({ error: "Notion integration not found or token missing." }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const notion = new NotionClient({ auth: notionToken });
    const response = await notion.search({
      query: query,
      filter: { value: 'page', property: 'object' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 15,
    });

    const pages = response.results.map(page => {
      const p = page as PageObjectResponse;
      let title = "Untitled";
      if (p.properties.title && p.properties.title.type === 'title' && p.properties.title.title[0]) {
        title = p.properties.title.title[0].plain_text;
      }
      return { id: p.id, title: title, icon: (p.icon as any) }; // Cast icon for simplicity
    });

    return NextResponse.json(pages);

  } catch (error: any) {
    console.error("Failed to search Notion pages:", error);
    return new NextResponse(JSON.stringify({ error: 'Failed to search Notion pages.', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST(request: Request) {
  const db = getDb(); // Get instance here
  const { userId } = getAuth(request as any);
  // ... existing code ...
} 