const SANDBOX_FLAG_KEY = 'pagelifelineSandbox';

function isSandboxMode(): boolean {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(SANDBOX_FLAG_KEY) === '1';
  }
  return false; // Default to false if not in browser environment (e.g., SSR, although this client is for browser)
}

interface ApiClientOptions extends RequestInit {
  // We can add custom options here if needed in the future
}

export async function apiClient<T = any>(
  input: string, // Original API path, e.g., '/api/snapshots'
  options?: ApiClientOptions
): Promise<T> {
  let effectiveInput = input;
  const sandbox = isSandboxMode();

  if (sandbox) {
    // Prepend /demo-api and remove leading /api if present
    // e.g., /api/snapshots -> /demo-api/snapshots
    // e.g., /user/quota -> /demo-api/user/quota (if original didn't have /api prefix)
    if (input.startsWith('/api/')) {
      effectiveInput = `/demo-api${input.substring(4)}`;
    } else {
      // Ensure it starts with a slash if not already
      const normalizedInput = input.startsWith('/') ? input : `/${input}`;
      effectiveInput = `/demo-api${normalizedInput}`;
    }
    console.log(`[apiClient] Sandbox mode: Rewriting '${input}' to '${effectiveInput}'`);
  }

  const response = await fetch(effectiveInput, options);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // If response is not JSON, use status text
      errorData = { message: response.statusText, status: response.status };
    }
    // Construct a more informative error
    const error = new Error(errorData.message || `API request failed with status ${response.status}`) as any;
    error.response = response; // Attach full response
    error.status = response.status;
    error.data = errorData; // Attach parsed error data if available
    throw error;
  }

  // Handle cases where response might be empty (e.g., 204 No Content)
  const contentType = response.headers.get("content-type");
  if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
    return undefined as T; // Or handle as appropriate, maybe return response itself
  }

  return response.json() as Promise<T>;
}

// You can also create specific methods if needed, e.g.:
// apiClient.get = (input, options) => apiClient(input, { ...options, method: 'GET' });
// apiClient.post = (input, body, options) => apiClient(input, { ...options, method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...options?.headers } });

export default apiClient; 