export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Environment variables for Notion OAuth
const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI; // e.g., http://localhost:3000/api/auth/notion/callback or your production URL

export async function GET(request: Request) {
  try {
    // Ensure user is logged in before starting OAuth
    const { userId } = await auth();
    if (!userId) {
      // Redirect to sign-in if not authenticated, maybe pass original destination?
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    if (!NOTION_CLIENT_ID || !NOTION_REDIRECT_URI) {
        console.error("Notion OAuth environment variables missing");
        return new NextResponse("Configuration error", { status: 500 });
    }

    // Construct the Notion authorization URL
    const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', NOTION_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', NOTION_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    // state: Optional, but recommended for security (e.g., generate CSRF token, store in session, verify in callback)
    // authUrl.searchParams.set('state', 'your_random_state_value'); 
    authUrl.searchParams.set('owner', 'user'); // Required parameter

    console.log(`Redirecting user ${userId} to Notion OAuth: ${authUrl.toString()}`);

    // Redirect the user to Notion
    return NextResponse.redirect(authUrl);

  } catch (error) {
    console.error("Error starting Notion OAuth flow:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 