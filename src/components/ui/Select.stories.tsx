import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title: "Primitives/Select",
  component: Select,
  args: { label: "Region" },
  render: (args) => (
    <Select {...args}>
      <option value="US">United States</option>
      <option value="GB">United Kingdom</option>
      <option value="NG">Nigeria</option>
    </Select>
  ),
};
export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {};
export const WithError: Story = { args: { error: "Please choose a region" } };
