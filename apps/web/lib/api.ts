export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Use relative URLs — Next.js rewrites proxy /api/* to the backend.
  // This keeps cookies first-party (same domain) and avoids third-party cookie blocking.
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error((error as { error?: string }).error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}
