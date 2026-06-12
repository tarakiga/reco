import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  args: { label: "Username", placeholder: "e.g. moviefan42" },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithHint: Story = { args: { hint: "3-20 characters, letters and numbers" } };
export const WithError: Story = { args: { error: "That username is taken" } };
