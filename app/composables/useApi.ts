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

  async function request<T>(path: string, opts: Parameters<typeof $fetch>[1]): Promise<T> {
    try {
      return await $fetch<T>(`${base}${path}`, { credentials: "include", ...opts });
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 401) {
        const { logout } = useAuth();
        await logout('expired');
      }
      throw err;
    }
  }

  async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return request<T>(path, { params });
  }

  async function post<T = unknown>(path: string, body?: Record<string, unknown> | unknown[]): Promise<T> {
    return request<T>(path, { method: "POST", body: body as Record<string, unknown> });
  }

  async function patch<T = unknown>(path: string, body?: Record<string, unknown> | unknown[]): Promise<T> {
    return request<T>(path, { method: "PATCH", body: body as Record<string, unknown> });
  }

  async function put<T = unknown>(path: string, body?: Record<string, unknown> | unknown[]): Promise<T> {
    return request<T>(path, { method: "PUT", body: body as Record<string, unknown> });
  }

  async function del<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    return request<T>(path, { method: "DELETE", params });
  }

  return { get, post, patch, put, del };
};
