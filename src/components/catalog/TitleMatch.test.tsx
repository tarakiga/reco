import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TitleMatch } from "./TitleMatch";

let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown) {
  return new Response(JSON.stringify(body));
}

function serve(titleState: unknown, match: Record<string, number>) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/v1/me/title-state")) return json(titleState);
    if (url.startsWith("/api/v1/me/match")) return json({ match });
    return new Response("{}", { status: 404 });
  });
}

function setup(titleId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TitleMatch titleId={titleId} mediaType="movie" tmdbId={603} />
    </QueryClientProvider>,
  );
}

const matchCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith("/api/v1/me/match"));

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("falls back to the title id from the user's title-state when the cached page has none", async () => {
  serve({ status: null, score: null, favourite: false, signedIn: true, titleId: "row-1" }, { "row-1": 82 });
  setup("");
  expect(await screen.findByText("82% match")).toBeInTheDocument();
  expect(matchCalls()[0][0]).toBe("/api/v1/me/match?titleIds=row-1");
});

test("uses the page's title id when it has one", async () => {
  serve({ status: null, score: null, favourite: false, signedIn: true, titleId: "row-1" }, { "page-id": 64 });
  setup("page-id");
  expect(await screen.findByText("64% match")).toBeInTheDocument();
  expect(matchCalls()[0][0]).toBe("/api/v1/me/match?titleIds=page-id");
});

test("renders nothing and never asks for a match without any title id", async () => {
  serve({ status: null, score: null, favourite: false, signedIn: false }, {});
  const { container } = setup("");
  await new Promise((r) => setTimeout(r, 30));
  expect(container).toBeEmptyDOMElement();
  expect(matchCalls()).toHaveLength(0);
});
