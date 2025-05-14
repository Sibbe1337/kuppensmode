import keytar from 'keytar';
import axios from 'axios';
import { URLSearchParams } from 'node:url';
import { CLERK_CLIENT_ID as AppClerkClientId } from './config'; // Import from config
// We'll need to figure out how to handle these dependencies later if they are also refactored,
// or if these functions need to call back to main.ts for them.
// For now, assume they might be passed or handled via events/callbacks.
// import { updateTrayMenu } from './trayManager'; // Example placeholder
// import { win } from './windowManager'; // Example placeholder

// --- Auth Service Constants ---
// export const CLERK_CLIENT_ID = 'pk_live_Y2xlcmsucGFnZWxpZmVsaW5lLmFwcCQ'; // MOVED to config
export const CLERK_TOKEN_ENDPOINT = 'https://clerk.pagelifeline.app/oauth/token'; // Stays here or move to config
export const CLERK_CLIENT_SECRET = 'sk_live_2zbanEkqqOqlpJf6aNZXVW3r9Cod69okaXIqP1lnuX'; // Stays here (sensitive, or backend managed), ensure it is used correctly if needed or removed if not.

// --- Constants for Keytar ---
export const KEYTAR_SERVICE = 'PageLifelineDesktop';
export const KEYTAR_ACCOUNT_JWT = 'userSessionJWT';

// --- Token Management Global State ---
let isRefreshingToken = false; // This state might be better managed if auth.ts becomes a class or uses a more robust state pattern

// --- Token Management Functions ---
export async function storeTokenObject(tokenObject: any): Promise<void> {
  if (!tokenObject || !tokenObject.accessToken) {
    throw new Error('[AuthService] Attempted to store invalid or incomplete token object.');
  }
  // Ensure essential fields for refresh and expiry are present, even if null initially from some flows
  const completeTokenObject = {
    accessToken: tokenObject.accessToken,
    refreshToken: tokenObject.refreshToken || null,
    idToken: tokenObject.idToken || null,
    userId: tokenObject.userId || null, 
    expiresIn: tokenObject.expiresIn || 3600, // Default if not provided
    obtainedAt: tokenObject.obtainedAt || Date.now(), // Default if not provided
  };
  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_JWT, JSON.stringify(completeTokenObject));
  console.log('[AuthService] Token object stored/updated in keychain.');
}

export async function getStoredTokenObject(): Promise<any | null> {
  try {
    const tokenString = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_JWT);
    if (tokenString) {
      const tokenObject = JSON.parse(tokenString);
      console.log('[AuthService] Token object retrieved from keychain.');
      return tokenObject;
    }
    console.log('[AuthService] No token object found in keychain.');
    return null;
  } catch (error) {
    console.error('[AuthService] Error retrieving/parsing token object from keychain:', error);
    try {
        await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_JWT);
        console.log('[AuthService] Deleted potentially corrupted token from keychain.');
    } catch (deleteError) {
        console.error('[AuthService] Failed to delete corrupted token:', deleteError);
    }
    return null;
  }
}

export async function clearStoredTokens(): Promise<void> {
  try {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_JWT);
    console.log('[AuthService] Tokens deleted from keychain.');
  } catch (error) {
    console.error('[AuthService] Error deleting tokens from keychain:', error);
    // Depending on policy, you might want to re-throw or handle specific errors
    throw error; // Or handle more gracefully
  }
}

// Forward declaration or placeholder for handleSignOut if it remains coupled
// This is tricky because handleSignOut calls updateTrayMenu and sends IPC to win.
// We will define a more decoupled version later or pass dependencies.
async function _placeholderHandleSignOut() {
    console.warn('_placeholderHandleSignOut called. Implement proper sign out from auth module or pass dependencies.');
    // This would typically involve: await keytar.deletePassword(...);
    // And then signaling to the main thread to update UI / send IPC.
}

export async function attemptTokenRefresh(
    _handleSignOutUICallback: () => Promise<void>
    ): Promise<string | null> {
  if (isRefreshingToken) {
    console.log('[AuthService] Token refresh already in progress. Waiting...');
    await new Promise(resolve => setTimeout(resolve, 3000)); 
    const refreshedTokenObj = await getStoredTokenObject();
    return refreshedTokenObj?.accessToken || null;
  }

  isRefreshingToken = true;
  console.log('[AuthService] Attempting to refresh token...');

  const currentTokenObject = await getStoredTokenObject();
  if (!currentTokenObject?.refreshToken) {
    console.log('[AuthService] No refresh token available. Clearing tokens and invoking UI sign out.');
    await clearStoredTokens().catch(e => console.error("Failed to clear tokens during refresh failure:", e));
    await _handleSignOutUICallback(); 
    isRefreshingToken = false;
    return null;
  }

  try {
    const response = await axios.post(CLERK_TOKEN_ENDPOINT, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentTokenObject.refreshToken,
      client_id: AppClerkClientId, // USE AppClerkClientId from config
      // client_secret: CLERK_CLIENT_SECRET, // This is sensitive; ensure it is needed for public clients & handled securely.
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, refresh_token, id_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error('New access token not received from refresh.');
    }

    const newTokensToStore = {
      accessToken: access_token,
      refreshToken: refresh_token || currentTokenObject.refreshToken, 
      idToken: id_token,
      userId: currentTokenObject.userId, 
      expiresIn: expires_in || 3600,
      obtainedAt: Date.now()
    };

    await storeTokenObject(newTokensToStore);
    console.log('[AuthService] Tokens refreshed and new tokens stored successfully via storeTokenObject.');
    isRefreshingToken = false;
    return newTokensToStore.accessToken;

  } catch (error: any) {
    console.error('[AuthService] ##### ERROR refreshing token #####:', error.isAxiosError ? error.toJSON() : error);
    if (error.response && (error.response.status === 400 || error.response.status === 401 || error.response.status === 403)) {
      console.log('[AuthService] Refresh token invalid or expired. Clearing tokens and invoking UI sign out.');
      await clearStoredTokens().catch(e => console.error("Failed to clear tokens during refresh failure:", e));
      await _handleSignOutUICallback();
    }
    isRefreshingToken = false;
    return null;
  }
}

export async function getStoredAccessToken(
    _handleSignOutUICallback: () => Promise<void>
    ): Promise<string | null> {
    let tokenObject = await getStoredTokenObject();

    if (tokenObject && tokenObject.accessToken) {
        const nowInSeconds = Date.now() / 1000;
        const tokenExpiryTime = (tokenObject.obtainedAt / 1000) + tokenObject.expiresIn;
        const bufferSeconds = 60; 

        if (tokenExpiryTime - bufferSeconds < nowInSeconds) {
            console.log('[AuthService] Access token expired or nearing expiry. Attempting refresh.');
            const newAccessToken = await attemptTokenRefresh(_handleSignOutUICallback);
            if (newAccessToken) {
                return newAccessToken;
            } else {
                console.log('[AuthService] Token refresh failed, user is effectively signed out.');
                return null; 
            }
        }
        return tokenObject.accessToken;
    }
    return null;
}

export async function exchangeCodeForTokensAndStore(
  oneTimeCode: string, 
  apiBaseUrl: string 
  ): Promise<{ success: boolean; userId?: string | null; error?: string; newAccessToken?: string | null }> {
  try {
    console.log('[AuthService] Exchanging one-time code for tokens...');
    const exchangeOtcUrl = `${apiBaseUrl}/api/auth/exchange-otc`;

    const tokenResponse = await axios.post(exchangeOtcUrl, { oneTimeCode });

    const { accessToken, refreshToken, idToken, expiresIn, userId } = tokenResponse.data;

    if (!accessToken) {
      throw new Error('Access Token not received from OTC exchange.');
    }

    const tokensToStore = {
      accessToken,
      refreshToken,
      idToken,
      userId,
      expiresIn: expiresIn || 3600,
      obtainedAt: Date.now()
    };

    await storeTokenObject(tokensToStore);
    console.log('[AuthService] Tokens from OTC exchange stored successfully.');
    return { success: true, userId: userId, newAccessToken: accessToken };

  } catch (error: any) {
    console.error('[AuthService] ##### ERROR exchanging OTC or storing tokens #####:', error.isAxiosError ? error.toJSON() : error);
    let errorMessage = 'Failed to complete sign in during token exchange.';
    if (error.response) {
      console.error('[AuthService] OTC Exchange Error response data:', error.response.data);
      errorMessage = error.response.data?.message || errorMessage;
    }
    return { success: false, error: errorMessage, userId: null, newAccessToken: null };
  }
}

// handleSignOut and handleOAuthCallback are more complex due to their dependencies
// on tray, window management, and notifications. They will be refactored later or their core logic moved here. 