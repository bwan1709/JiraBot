// Thin fetch wrapper around the Express API. Cookies (httpOnly user_id) ride along
// automatically since requests are same-origin (dev: via Vite proxy; prod: served by Express).

export interface ApiError extends Error {
  status?: number;
  code?: string; // backend `error` field, e.g. 'JIRA_401', 'no_data'
}

async function request<T = any>(
  path: string,
  method: string = 'GET',
  body?: unknown,
): Promise<T> {
  const opts: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty / non-JSON body */
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'Request failed') as ApiError;
    err.status = res.status;
    err.code = data && data.error;
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: unknown) => request<T>(path, 'POST', body),
  put: <T = any>(path: string, body?: unknown) => request<T>(path, 'PUT', body),
  del: <T = any>(path: string) => request<T>(path, 'DELETE'),
};

// Cache-busting helper matching the old `?t=Date.now()` pattern.
export const bust = () => `t=${Date.now()}`;
