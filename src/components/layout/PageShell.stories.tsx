import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageShell } from "./PageShell";
import { Button } from "../ui/Button";

const meta: Meta<typeof PageShell> = { title: "Layout/PageShell", component: PageShell };
export default meta;
type Story = StoryObj<typeof PageShell>;

export const Default: Story = {
  args: {
    brand: "Haystackk",
    navLinks: [
      { href: "/", label: "Home" },
      { href: "/movies", label: "Movies" },
      { href: "/tv", label: "TV Shows" },
    ],
    actions: <Button size="sm">Sign in</Button>,
    footer: <span>Footer content (attribution lands here in Plan 3)</span>,
    children: <div className="text-text-muted">Page content goes here</div>,
  },
};
