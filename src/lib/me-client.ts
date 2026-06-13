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
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // non-JSON body (e.g. a proxy/gateway error page) — leave data empty
    }
  }
  if (!res.ok) {
    throw new MeApiError(res.status, (data.error as string) ?? `Request failed (${res.status})`, data.issues);
  }
  return data as T;
}
