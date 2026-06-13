import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Rail } from "./Rail";
import { TitleCard } from "./TitleCard";

const meta: Meta<typeof Rail> = {
  title: "Catalog/Rail",
  component: Rail,
};
export default meta;
type Story = StoryObj<typeof Rail>;

const SAMPLE_TITLES = [
  { href: "/title/movie/603-the-matrix", title: "The Matrix", year: 1999, posterUrl: "https://image.tmdb.org/t/p/w185/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg" },
  { href: "/title/movie/604-the-matrix-reloaded", title: "The Matrix Reloaded", year: 2003, posterUrl: "https://image.tmdb.org/t/p/w185/9TBLDIoJA1NMBbHZMkBBRxBNHFj.jpg" },
  { href: "/title/movie/605-the-matrix-revolutions", title: "The Matrix Revolutions", year: 2003, posterUrl: null },
  { href: "/title/movie/624860-the-matrix-resurrections", title: "The Matrix Resurrections", year: 2021, posterUrl: null },
  { href: "/title/movie/157336-interstellar", title: "Interstellar", year: 2014, posterUrl: "https://image.tmdb.org/t/p/w185/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg" },
  { href: "/title/movie/27205-inception", title: "Inception", year: 2010, posterUrl: "https://image.tmdb.org/t/p/w185/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg" },
];

export const Default: Story = {
  render: () => (
    <Rail title="Trending Now">
      {SAMPLE_TITLES.map((t) => (
        // Each card needs a fixed width from the caller so the rail scrolls correctly
        <div key={t.href} className="w-32 shrink-0">
          <TitleCard {...t} />
        </div>
      ))}
    </Rail>
  ),
};
