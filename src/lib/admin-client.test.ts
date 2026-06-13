import { vi, beforeEach } from "vitest";
import { adminFetch, AdminApiError } from "./admin-client";

beforeEach(() => {
  vi.restoreAllMocks();
});

test("returns parsed json on ok", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true, version: 3 }), { status: 200 })),
  );
  await expect(adminFetch("/api/v1/admin/config/publish", { method: "POST", body: {} })).resolves.toEqual({
    ok: true,
    version: 3,
  });
});

test("throws AdminApiError with status and message on error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "Requires admin role" }), { status: 403 })),
  );
  const err = await adminFetch("/x", { method: "POST", body: {} }).catch((e) => e);
  expect(err).toBeInstanceOf(AdminApiError);
  expect(err).toMatchObject({
    status: 403,
    message: "Requires admin role",
  });
});

test("sends JSON body and header", async () => {
  const spy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", spy);
  await adminFetch("/y", { method: "PUT", body: { a: 1 } });
  const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string>; body: string }];
  expect(init.method).toBe("PUT");
  expect(init.headers["Content-Type"]).toBe("application/json");
  expect(init.body).toBe(JSON.stringify({ a: 1 }));
});
