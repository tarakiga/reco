import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

const meta: Meta<typeof EmptyState> = { title: "Primitives/EmptyState", component: EmptyState };
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: "No streaming info for your region",
    description: "We could not find availability data for this title where you are.",
  },
};
export const WithAction: Story = {
  args: {
    title: "Your watchlist is empty",
    description: "Find something to watch and add it here.",
    action: <Button>Browse titles</Button>,
  },
};
