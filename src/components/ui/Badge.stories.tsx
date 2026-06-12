import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = { title: "Primitives/Badge", component: Badge };
export default meta;
type Story = StoryObj<typeof Badge>;

export const All: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="neutral">Draft</Badge>
      <Badge variant="success">Published</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="danger">Disabled</Badge>
    </div>
  ),
};
