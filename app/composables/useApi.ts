/**
 * useApi — typed $fetch wrapper that automatically:
 *  - Prefixes all paths with the configured backend base URL
 *  - Sends credentials (JWT cookie) with every request
 *
 * Usage:
 *   const api = useApi();
 *   const data = await api.get<ResponseType>('/api/players/members', { page: 1 });
 *   await api.post('/api/stat-snapshots', { ... });
 */
export const useApi = () => {
  const config = useRuntimeConfig();
  const base = config.public.backendUrl as string;

  async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return $fetch<T>(`${base}${path}`, {
      credentials: "include",
      params,
    });
  }

  async function post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return $fetch<T>(`${base}${path}`, {
      method: "POST",
      credentials: "include",
      body,
    });
  }

  async function patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return $fetch<T>(`${base}${path}`, {
      method: "PATCH",
      credentials: "include",
      body,
    });
  }

  async function put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return $fetch<T>(`${base}${path}`, {
      method: "PUT",
      credentials: "include",
      body,
    });
  }

  async function del<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    return $fetch<T>(`${base}${path}`, {
      method: "DELETE",
      credentials: "include",
      params,
    });
  }

  return { get, post, patch, put, del };
};
