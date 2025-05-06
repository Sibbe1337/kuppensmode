import { Firestore, FieldValue } from '@google-cloud/firestore';

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS; // Should be an ABSOLUTE path if set for local dev

if (!projectId) {
  // This should ideally not happen if .env.local is correctly loaded or if deployed with GOOGLE_CLOUD_PROJECT set.
  console.error("FATAL_ERROR: GOOGLE_CLOUD_PROJECT environment variable is not set. Firestore cannot be initialized.");
  // Depending on your error handling strategy, you might throw an error here to prevent startup,
  // or allow a "dummy" db instance that will fail on first use.
  // For now, we'll let it proceed, and Firestore constructor might throw or use defaults if possible.
}

if (!keyFilename && process.env.NODE_ENV === 'development') {
  // In local development, we usually expect a keyfile for the Admin SDK.
  // In production on GCP, Application Default Credentials would be used if keyFilename is not set.
  console.warn("WARNING: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. For local development, this is usually required for the Admin SDK to authenticate. Firestore will attempt to use Application Default Credentials if available, or may fail to connect.");
}

console.log(`Initializing shared Firestore instance. ProjectId: ${projectId}` + 
            (keyFilename ? `, KeyFilename: ${keyFilename}` : '. GOOGLE_APPLICATION_CREDENTIALS not set, attempting Application Default Credentials.'));

export const db = new Firestore({
  ...(projectId && { projectId: projectId }), // Conditionally add projectId if it's set
  ...(keyFilename && { keyFilename: keyFilename }), // Conditionally add keyFilename if it's set
  ignoreUndefinedProperties: true,
});

console.log('Shared Firestore Admin SDK instance has been configured in lib/firestore.ts.');

// Export FieldValue directly for convenience
export { FieldValue };

console.log('Firestore Admin SDK initialized for Next.js backend.'); 