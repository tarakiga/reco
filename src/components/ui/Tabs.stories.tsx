import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Tabs } from "./Tabs";

const meta: Meta<typeof Tabs> = { title: "Primitives/Tabs", component: Tabs };
export default meta;
type Story = StoryObj<typeof Tabs>;

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState("movies");
    return (
      <Tabs
        items={[
          { id: "movies", label: "Movies" },
          { id: "tv", label: "TV Shows" },
          { id: "people", label: "People" },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  },
};
