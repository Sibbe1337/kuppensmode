// Placeholder for secret retrieval logic
// You MUST replace this with your actual secret management implementation.

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Initialize the client outside of the function for potential reuse
let secretManagerClient: SecretManagerServiceClient;
try {
  secretManagerClient = new SecretManagerServiceClient();
  console.log('Google Secret Manager client initialized successfully.');
} catch (error) {
  console.error("Failed to initialize Google Secret Manager client:", error);
  // Depending on how critical secrets are, you might want to throw here
  // or handle it in a way that functions requiring secrets will fail gracefully.
}

interface GetSecretOptions {
  version?: string; // e.g., 'latest' or a specific version number
  projectId?: string; // GCP project ID, defaults to one from environment if not provided
}

/**
 * Retrieves a secret value from Google Secret Manager.
 * 
 * @param secretName The name of the secret to retrieve (the ID of the secret).
 * @param options Optional parameters: version (defaults to 'latest') and projectId.
 * @returns The secret value as a string, or undefined if not found or on error.
 */
export const getSecret = async (
  secretName: string,
  options?: GetSecretOptions
): Promise<string | undefined> => {
  if (!secretManagerClient) {
    console.error('Google Secret Manager client is not initialized. Cannot fetch secrets.');
    return undefined;
  }

  const resolvedProjectId = options?.projectId || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!resolvedProjectId) {
    console.error(
      `Cannot determine GCP Project ID for secret "${secretName}". ` +
      `Provide it in options.projectId, or ensure GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT env var is set.`
    );
    return undefined;
  }

  const version = options?.version || 'latest';
  const name = `projects/${resolvedProjectId}/secrets/${secretName}/versions/${version}`;

  console.log(`Attempting to retrieve secret: "${name}"`);

  try {
    const [secretVersion] = await secretManagerClient.accessSecretVersion({ name });
    const payload = secretVersion.payload?.data?.toString();

    if (payload) {
      // console.log(`Successfully retrieved secret: ${secretName} (version: ${version})`);
      return payload;
    } else {
      console.warn(`Secret "${secretName}" (version: ${version}) found but payload was empty.`);
      return undefined;
    }
  } catch (error: unknown) {
    let errorMessage = 'Unknown error retrieving secret.';
    let errorCode: number | undefined = undefined;

    if (typeof error === 'object' && error !== null) {
      if ('message' in error) errorMessage = (error as { message: string }).message;
      if ('code' in error) errorCode = (error as { code: number }).code;
    }

    if (errorCode === 5) { // 5 is gRPC status code for NOT_FOUND
      console.warn(`Secret "${secretName}" (version: ${version}) not found in project "${resolvedProjectId}".`);
    } else {
      console.error(`Error retrieving secret "${secretName}" (version: ${version}) from Google Secret Manager: ${errorMessage}`);
    }
    return undefined;
  }
};

// You might also want to add other secret-related utility functions here if needed.
