export class AdminApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly issues?: unknown) {
    super(message);
  }
}

interface AdminFetchOptions {
  method?: "GET" | "PUT" | "POST" | "DELETE";
  body?: unknown;
}

export async function adminFetch<T = unknown>(url: string, opts: AdminFetchOptions = {}): Promise<T> {
  const init: RequestInit & { headers: Record<string, string> } = {
    method: opts.method ?? "GET",
    headers: {},
  };
  if (opts.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // non-JSON body (e.g. a proxy/gateway error page) — leave data empty
    }
  }
  if (!res.ok) {
    throw new AdminApiError(res.status, (data.error as string) ?? `Request failed (${res.status})`, data.issues);
  }
  return data as T;
}
