export async function fetcher<T = unknown>(...args: Parameters<typeof fetch>): Promise<T> {
  const res = await fetch(...args)
  if (!res.ok) throw new Error(res.statusText)
  return res.json() as Promise<T>
} 