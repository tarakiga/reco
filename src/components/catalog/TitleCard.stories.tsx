import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TitleCard } from "./TitleCard";

const meta: Meta<typeof TitleCard> = {
  title: "Catalog/TitleCard",
  component: TitleCard,
};
export default meta;
type Story = StoryObj<typeof TitleCard>;

export const Default: Story = {
  render: () => (
    <div className="w-40">
      <TitleCard
        href="/title/movie/603-the-matrix"
        title="The Matrix"
        year={1999}
        posterUrl="https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"
      />
    </div>
  ),
};

export const NoPoster: Story = {
  render: () => (
    <div className="w-40">
      <TitleCard
        href="/title/movie/999-unknown-film"
        title="Unknown Film"
        year={2024}
        posterUrl={null}
      />
    </div>
  ),
};
