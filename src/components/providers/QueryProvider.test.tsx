import { render } from "@testing-library/react";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryProvider } from "./QueryProvider";

type Auth = { isLoaded: boolean; userId: string | null | undefined };

const auth = vi.hoisted(() => ({
  current: { isLoaded: false, userId: undefined } as { isLoaded: boolean; userId: string | null | undefined },
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => auth.current,
}));

let clearSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clearSpy = vi.spyOn(QueryClient.prototype, "clear");
});

afterEach(() => {
  clearSpy.mockRestore();
});

function mount(first: Auth) {
  auth.current = first;
  const view = render(
    <QueryProvider>
      <span />
    </QueryProvider>,
  );
  return (next: Auth) => {
    auth.current = next;
    view.rerender(
      <QueryProvider>
        <span />
      </QueryProvider>,
    );
  };
}

test("does not clear while Clerk loads or on the first known account", () => {
  const to = mount({ isLoaded: false, userId: undefined });
  to({ isLoaded: true, userId: "user_a" });
  to({ isLoaded: true, userId: "user_a" });
  expect(clearSpy).not.toHaveBeenCalled();
});

test("does not clear on the first known signed-out state", () => {
  const to = mount({ isLoaded: false, userId: undefined });
  to({ isLoaded: true, userId: null });
  expect(clearSpy).not.toHaveBeenCalled();
});

test("clears on sign-out (account to null)", () => {
  const to = mount({ isLoaded: true, userId: "user_a" });
  expect(clearSpy).not.toHaveBeenCalled();
  to({ isLoaded: true, userId: null });
  expect(clearSpy).toHaveBeenCalledTimes(1);
});

test("clears on an account switch (A to B)", () => {
  const to = mount({ isLoaded: true, userId: "user_a" });
  to({ isLoaded: true, userId: "user_b" });
  expect(clearSpy).toHaveBeenCalledTimes(1);
});

test("clears on sign-in after a known signed-out state (null to A)", () => {
  const to = mount({ isLoaded: true, userId: null });
  to({ isLoaded: true, userId: "user_a" });
  expect(clearSpy).toHaveBeenCalledTimes(1);
});

test("queries the page builds for the new account survive the clear", async () => {
  let client: QueryClient | null = null;
  function Probe({ userId }: { userId: string | null }) {
    client = useQueryClient();
    useQuery({ queryKey: ["probe", userId], queryFn: () => `data for ${userId}`, staleTime: Infinity });
    return null;
  }
  auth.current = { isLoaded: true, userId: "user_a" };
  const view = render(
    <QueryProvider>
      <Probe userId="user_a" />
    </QueryProvider>,
  );
  auth.current = { isLoaded: true, userId: "user_b" };
  view.rerender(
    <QueryProvider>
      <Probe userId="user_b" />
    </QueryProvider>,
  );
  expect(clearSpy).toHaveBeenCalledTimes(1);
  await vi.waitFor(() =>
    expect(client!.getQueryData(["probe", "user_b"])).toBe("data for user_b"),
  );
  expect(client!.getQueryData(["probe", "user_a"])).toBeUndefined();
});
