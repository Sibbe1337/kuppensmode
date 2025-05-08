import { Firestore, FieldValue } from '@google-cloud/firestore';

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
// const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS; // No longer using file path on Vercel
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON; // Using JSON content from env var

let clientConfig: any = {
  ...(projectId && { projectId: projectId }),
  ignoreUndefinedProperties: true,
};

if (keyJsonString) {
  try {
    // Check if running in Vercel or similar environment where JSON key is directly provided
    console.log('Attempting to use credentials from GCP_SERVICE_ACCOUNT_KEY_JSON env var.');
    const credentials = JSON.parse(keyJsonString);
    clientConfig = { ...clientConfig, credentials };
  } catch (e) {
    console.error("FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
    // Consider throwing error if credentials are required and parsing failed
    throw new Error("Invalid GCP Service Account Key JSON provided.");
  }
} else if (process.env.NODE_ENV !== 'production') {
  // Fallback for local development using Application Default Credentials (if keyJsonString isn't set)
  // Assumes gcloud auth application-default login has been run locally.
  console.warn("GCP_SERVICE_ACCOUNT_KEY_JSON not set. Attempting Application Default Credentials for Firestore (may fail).");
} else {
  // In production on Vercel, we EXPECT the JSON key to be set.
  console.error('FATAL: GCP_SERVICE_ACCOUNT_KEY_JSON is not set in production environment. Firestore cannot authenticate.');
  // Throw error to prevent app from potentially running without DB access
  throw new Error("Missing GCP Service Account Key JSON for Firestore authentication.");
}

console.log(`Initializing shared Firestore instance. ProjectId: ${clientConfig.projectId || 'Default'}. Auth method: ${clientConfig.credentials ? 'JSON Key Var' : 'ADC / Default'}`);

export const db = new Firestore(clientConfig);

console.log('Shared Firestore Admin SDK instance has been configured in lib/firestore.ts.');

// Export FieldValue directly for convenience
export { FieldValue };

console.log('Firestore Admin SDK initialized for Next.js backend.'); 