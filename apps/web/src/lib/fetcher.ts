/**
 * Basic fetcher function for use with SWR.
 * Takes a URL, fetches it, and returns the JSON response.
 * Throws an error if the fetch response is not OK.
 */
export const fetcher = async <T = any>(url: string): Promise<T> => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    // Attempt to attach more info to the error object
    try {
      const errorInfo = await res.json();
      (error as any).info = errorInfo;
    } catch (e) {
      // Ignore if response is not JSON
    }
    (error as any).status = res.status;
    throw error;
  }

  return res.json();
}; 