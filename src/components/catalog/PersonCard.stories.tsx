import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PersonCard } from "./PersonCard";

const meta: Meta<typeof PersonCard> = {
  title: "Catalog/PersonCard",
  component: PersonCard,
};
export default meta;
type Story = StoryObj<typeof PersonCard>;

export const Default: Story = {
  render: () => (
    <div className="w-32">
      <PersonCard
        href="/person/6384-keanu-reeves"
        name="Keanu Reeves"
        profileUrl="https://image.tmdb.org/t/p/w185/4D0PpNI0kmP58hgrwGC3wCjxhnm.jpg"
        subtitle="Neo"
      />
    </div>
  ),
};

export const NoPhoto: Story = {
  render: () => (
    <div className="w-32">
      <PersonCard
        href="/person/9999-unknown-actor"
        name="Unknown Actor"
        profileUrl={null}
        subtitle="Various roles"
      />
    </div>
  ),
};
