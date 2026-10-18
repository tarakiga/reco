import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SeasonSummary } from "@/lib/tmdb/episodes";
import { WatchProgress } from "./WatchProgress";

const auth = vi.hoisted(() => ({
  current: { isLoaded: true, isSignedIn: true, userId: "user_1" as string | null },
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => auth.current,
}));

const seasons: SeasonSummary[] = [
  { seasonNumber: 1, name: "Season 1", episodeCount: 2, year: 2008, posterUrl: null },
  { seasonNumber: 2, name: "Season 2", episodeCount: 3, year: 2009, posterUrl: null },
];

type Watches = { episodes: { season: number; episode: number }[] };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  auth.current = { isLoaded: true, isSignedIn: true, userId: "user_1" };
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(seed?: Watches) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seed) client.setQueryData(["episode-watches", 1396], seed);
  render(
    <QueryClientProvider client={client}>
      <WatchProgress tvId={1396} seasons={seasons} />
    </QueryClientProvider>,
  );
  return client;
}

test("shows progress from the shared episode-watches query and follows cache updates", async () => {
  const client = setup({ episodes: [{ season: 1, episode: 1 }] });
  expect(screen.getByText("1 of 5 episodes")).toBeInTheDocument();
  expect(screen.getByText("Next up: S1 E2")).toBeInTheDocument();

  act(() => {
    client.setQueryData<Watches>(["episode-watches", 1396], {
      episodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
    });
  });

  // React Query notifies observers on its own tick, so wait for the re-render.
  expect(await screen.findByText("2 of 5 episodes")).toBeInTheDocument();
  expect(screen.getByText("Next up: S2 E1")).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("renders nothing and never fetches when signed out", async () => {
  auth.current = { isLoaded: true, isSignedIn: false, userId: null };
  setup();
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.queryByText(/episodes$/)).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
