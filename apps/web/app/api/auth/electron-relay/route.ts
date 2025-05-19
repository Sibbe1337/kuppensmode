import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server'; // clerkClient might be needed if getAuth isn't sufficient for code exchange
import { getDb } from '@/lib/firestore'; // Assuming you have a Firestore init helper
import { randomUUID } from 'crypto';

const db = getDb();
const OTC_COLLECTION = 'nativeAuthOneTimeCodes';
const OTC_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Load Clerk credentials from environment variables
const BACKEND_CLERK_CLIENT_ID = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY; // Or a specific backend client ID
const BACKEND_CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_TOKEN_ENDPOINT_URL = 'https://clerk.pagelifeline.app/oauth/token'; // From your discovery doc

interface ClerkTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface AppTokenData {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  userId: string;
  expiresIn?: number;
}

async function exchangeClerkCodeForTokens(authCode: string, relayCallbackUrl: string): Promise<AppTokenData | null> {
  if (!BACKEND_CLERK_CLIENT_ID || !BACKEND_CLERK_SECRET_KEY) {
    console.error('[electron-relay] CRITICAL: Missing Clerk backend credentials (Client ID or Secret Key) in environment variables.');
    // In a real app, you might throw an error or handle this more gracefully depending on monitoring.
    return null;
  }

  const tokenParams = new URLSearchParams();
  tokenParams.append('grant_type', 'authorization_code');
  tokenParams.append('code', authCode);
  tokenParams.append('redirect_uri', relayCallbackUrl); // This is the URL of this /api/auth/electron-relay route
  tokenParams.append('client_id', BACKEND_CLERK_CLIENT_ID);
  tokenParams.append('client_secret', BACKEND_CLERK_SECRET_KEY);

  try {
    console.log(`[electron-relay] Exchanging auth code for tokens. Endpoint: ${CLERK_TOKEN_ENDPOINT_URL}, ClientID: ${BACKEND_CLERK_CLIENT_ID}`);
    const response = await fetch(CLERK_TOKEN_ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      let errorData = { error: 'unknown_error', error_description: 'Token exchange failed with status: ' + response.status };
      try {
        errorData = await response.json();
      } catch (e) { /* ignore if response not json */ }
      console.error('[electron-relay] Clerk token exchange failed. Status:', response.status, 'Response:', errorData);
      throw new Error(errorData.error_description || 'Clerk token exchange failed');
    }

    const tokens: ClerkTokenResponse = await response.json();
    
    let userIdFromToken = 'unknown_user';
    if (tokens.id_token) {
      try {
        const idTokenPayload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
        userIdFromToken = idTokenPayload.sub || userIdFromToken;
      } catch (e) {
        console.warn('[electron-relay] Could not parse ID token to get sub (userId).');
      }
    }
    
    console.log(`[electron-relay] Tokens successfully exchanged for user: ${userIdFromToken}`);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      userId: userIdFromToken,
      expiresIn: tokens.expires_in,
    };

  } catch (error: any) {
    console.error('[electron-relay] Error in exchangeClerkCodeForTokens:', error.message);
    return null;
  }
}

async function createOneTimeCode(userId: string, tokens: AppTokenData): Promise<string> {
  const otc = randomUUID();
  const expiresAt = Date.now() + OTC_EXPIRY_MS;
  await db.collection(OTC_COLLECTION).doc(otc).set({
    userId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    idToken: tokens.idToken,
    expiresIn: tokens.expiresIn,
    clerkUserId: userId, // Storing the Clerk User ID explicitly
    expiresAt
  });
  console.log(`[electron-relay] Created OTC ${otc} for user ${userId}`);
  return otc;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error(`[electron-relay] Error from Clerk in callback: ${error} - ${searchParams.get('error_description')}`);
    return NextResponse.redirect(`pagelifeline://auth-callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(searchParams.get('error_description') || 'Unknown error from IdP')}`);
  }

  if (!code) {
    console.error('[electron-relay] No code received from Clerk.');
    return NextResponse.redirect('pagelifeline://auth-callback?error=no_auth_code');
  }

  try {
    console.log(`[electron-relay] Received code: ${code}. Attempting to exchange for tokens.`);
    const thisRouteUrl = req.nextUrl.clone();
    thisRouteUrl.search = ''; 
    
    const clerkTokens = await exchangeClerkCodeForTokens(code, thisRouteUrl.toString()); 

    if (!clerkTokens || !clerkTokens.accessToken) {
      console.error('[electron-relay] Failed to obtain valid tokens from Clerk backend exchange.');
      return NextResponse.redirect('pagelifeline://auth-callback?error=token_exchange_failed');
    }

    const otc = await createOneTimeCode(clerkTokens.userId, clerkTokens);
    const redirectUrl = `pagelifeline://auth-callback?one_time_code=${otc}`;
    console.log(`[electron-relay] Redirecting to Electron app with OTC: ${redirectUrl}`);
    return NextResponse.redirect(redirectUrl);

  } catch (err: any) {
    console.error('[electron-relay] Fatal error during token exchange or OTC creation:', err);
    return NextResponse.redirect(`pagelifeline://auth-callback?error=internal_relay_error&error_description=${encodeURIComponent(err.message || 'Unknown relay error')}`);
  }
} 