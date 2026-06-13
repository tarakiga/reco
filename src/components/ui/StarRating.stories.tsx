import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { StarRating } from "./StarRating";

const meta: Meta<typeof StarRating> = {
  title: "Primitives/StarRating",
  component: StarRating,
};
export default meta;
type Story = StoryObj<typeof StarRating>;

export const Interactive: Story = {
  render: () => {
    const [v, setV] = useState(0);
    return <StarRating value={v} onChange={setV} />;
  },
};
export const ReadOnly: Story = { args: { value: 4, readOnly: true } };
