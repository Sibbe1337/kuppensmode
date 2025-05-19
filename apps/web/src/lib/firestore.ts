import { Firestore, FieldValue } from '@google-cloud/firestore';

let dbInstance: Firestore | null = null;

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
// const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS; // No longer using file path on Vercel
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON; // Using JSON content from env var

function getDbInstance(): Firestore {
  if (dbInstance) {
    return dbInstance;
  }

  let clientConfig: any = {
    ...(projectId && { projectId: projectId }),
    ignoreUndefinedProperties: true,
  };

  if (keyJsonString) {
    try {
      console.log('[Firestore Lib] Attempting to use credentials from GCP_SERVICE_ACCOUNT_KEY_JSON env var.');
      const credentials = JSON.parse(keyJsonString);
      clientConfig = { ...clientConfig, credentials };
    } catch (e) {
      console.error("[Firestore Lib] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
      throw new Error("Invalid GCP Service Account Key JSON provided."); // Bad JSON is a fatal config error
    }
  } else {
    // If keyJsonString is NOT provided:
    if (process.env.NODE_ENV === 'production') {
        // In any production-like environment (build or runtime), if the key is missing, warn but don't throw here.
        console.warn('[Firestore Lib] GCP_SERVICE_ACCOUNT_KEY_JSON is NOT SET. Firestore client will be initialized without explicit credentials. Operations may fail at runtime if ADC are not available/configured.');
    } else {
        // Development environment, key not set, ADC will be attempted.
        console.warn("[Firestore Lib] GCP_SERVICE_ACCOUNT_KEY_JSON not set. Attempting Application Default Credentials for Firestore (development).");
    }
  }
  
  console.log(`[Firestore Lib] Initializing shared Firestore instance. ProjectId: ${clientConfig.projectId || 'Default'}. Auth method: ${clientConfig.credentials ? 'JSON Key Var' : 'Default/ADC'}`);
  dbInstance = new Firestore(clientConfig);
  console.log('[Firestore Lib] Shared Firestore Admin SDK instance has been configured.');
  return dbInstance;
}

// Export a getter for the db instance
export const getDb = () => getDbInstance();

// Export FieldValue directly for convenience
export { FieldValue };

console.log('[Firestore Lib] Firestore module loaded (instance will be initialized on first use).'); 