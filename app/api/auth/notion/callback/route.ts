import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore'; // Uncommented and assuming correct path
import { FieldValue } from '@google-cloud/firestore'; // For serverTimestamp
// import { db } from '@/lib/firestore'; // TODO: Import Firestore utility

// Environment variables for Notion OAuth
const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI; // Must match the one used in /start

export async function GET(request: Request) {
  try {
    // 1. Ensure user is logged in (should have session from before starting OAuth)
    const { userId } = await auth();
    if (!userId) {
      // This shouldn't typically happen if the flow started correctly
      return new NextResponse("Unauthorized: No active session during callback", { status: 401 });
    }

    // 2. Extract code and state from query parameters
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    // const state = searchParams.get('state'); // TODO: Get state if used

    if (error) {
        console.error(`Notion OAuth Error for user ${userId}:`, error);
        // Redirect to settings page with error query param?
        return NextResponse.redirect(new URL('/dashboard/settings?error=notion_oauth_failed', request.url));
    }

    if (!code) {
        console.error(`Notion OAuth Callback missing code for user ${userId}`);
        return new NextResponse("Missing authorization code", { status: 400 });
    }

    // TODO: Verify state parameter here if you used one in the /start route

    if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET || !NOTION_REDIRECT_URI) {
        console.error("Notion OAuth token exchange environment variables missing");
        return new NextResponse("Configuration error", { status: 500 });
    }

    // 3. Exchange code for access token
    const tokenUrl = 'https://api.notion.com/v1/oauth/token';
    const encodedCredentials = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encodedCredentials}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28' // Use the version your app targets
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: NOTION_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error(`Notion token exchange failed for user ${userId}:`, tokenResponse.status, errorBody);
        throw new Error(`Failed to exchange Notion code for token: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const workspaceId = tokenData.workspace_id;
    const workspaceName = tokenData.workspace_name;
    // Other data like bot_id, workspace_icon, owner might be available

    if (!accessToken) {
        console.error(`Notion token exchange did not return access token for user ${userId}`);
        throw new Error("Did not receive access token from Notion.");
    }

    console.log(`Successfully obtained Notion token for user ${userId}, workspace: ${workspaceName} (${workspaceId})`);

    // 4. Securely store the accessToken, workspaceId, workspaceName etc.
    const userDocRef = db.collection('users').doc(userId);
    const notionIntegrationRef = userDocRef.collection('integrations').doc('notion');

    try {
      // Store detailed token info in the subcollection
      await notionIntegrationRef.set({
        accessToken: accessToken, // TODO: Encrypt this token!
        workspaceId: workspaceId,
        workspaceName: workspaceName,
        workspaceIcon: tokenData.workspace_icon, // if available
        botId: tokenData.bot_id,           // if available
        ownerInfo: tokenData.owner,        // if available (usually user info)
        connectedAt: FieldValue.serverTimestamp(),
      });

      // Update the parent user document
      await userDocRef.update({
        'settings.notionConnected': true,
        'settings.notionWorkspaceId': workspaceId,
        'settings.notionWorkspaceName': workspaceName,
        'settings.notionWorkspaceIcon': tokenData.workspace_icon, // if available
        'activation.connectedNotion': true,
      });

      console.log(`Notion token details stored and activation marked for user ${userId}`);

      // 5. Redirect user back to the settings page (or a success page)
      return NextResponse.redirect(new URL('/dashboard/settings?notion=connected', request.url));

    } catch (dbError) {
      console.error(`Firestore error storing Notion token for user ${userId}:`, dbError);
      // Redirect with a specific database error if possible, or a generic one
      return NextResponse.redirect(new URL('/dashboard/settings?error=notion_db_error', request.url));
    }

  } catch (error) {
    console.error("Error handling Notion OAuth callback:", error);
    // Redirect to settings page with generic error?
    return NextResponse.redirect(new URL('/dashboard/settings?error=notion_callback_failed', request.url));
  }
} 