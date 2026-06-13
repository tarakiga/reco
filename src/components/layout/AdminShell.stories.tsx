import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminShell } from "./AdminShell";

const meta: Meta<typeof AdminShell> = { title: "Layout/AdminShell", component: AdminShell };
export default meta;
type Story = StoryObj<typeof AdminShell>;

export const Default: Story = {
  args: {
    navLinks: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/options", label: "Options" },
      { href: "/admin/content", label: "Content" },
      { href: "/admin/audit", label: "Audit log" },
    ],
    children: <div className="text-text-muted">Admin content area</div>,
  },
};
