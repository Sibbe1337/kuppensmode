export const API_BASE_URL = 'https://www.pagelifeline.app';
// export const API_BASE_URL = 'http://localhost:3000'; // For local Next.js dev server

export const CLERK_CLIENT_ID = 'pk_live_Y2xlcmsucGFnZWxpZmVsaW5lLmFwcCQ';

// CLERK_TOKEN_ENDPOINT is used by auth.ts and is already there, but could also be here.
// export const CLERK_TOKEN_ENDPOINT = 'https://clerk.pagelifeline.app/oauth/token';

// CLERK_CLIENT_SECRET is highly sensitive and should ideally not be in frontend/client-side config.
// It's currently in auth.ts (commented out in usage) and should be primarily managed by your backend if used there.
// export const CLERK_CLIENT_SECRET = 'your_clerk_secret_key_here';

console.log('[Config] Loaded API_BASE_URL:', API_BASE_URL);
console.log('[Config] Loaded CLERK_CLIENT_ID:', CLERK_CLIENT_ID); 