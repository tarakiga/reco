export class MeApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly issues?: unknown) {
    super(message);
  }
}

interface MeFetchOptions {
  method?: "GET" | "PUT" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
}

export async function meFetch<T = unknown>(url: string, opts: MeFetchOptions = {}): Promise<T> {
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
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new MeApiError(res.status, data.error ?? `Request failed (${res.status})`, data.issues);
  }
  return data as T;
}
