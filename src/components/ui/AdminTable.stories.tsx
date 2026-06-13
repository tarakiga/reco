import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminTable } from "./AdminTable";

interface DemoRow { id: string; key: string; label: string; }

const meta: Meta<typeof AdminTable> = {
  title: "Admin/AdminTable",
  component: AdminTable,
};
export default meta;
type Story = StoryObj<typeof AdminTable>;

const rows: DemoRow[] = [
  { id: "1", key: "home", label: "Home" },
  { id: "2", key: "movies", label: "Movies" },
];

export const WithRows: Story = {
  args: {
    rows,
    rowKey: (r: unknown) => (r as DemoRow).id,
    columns: [
      { header: "Key", cell: (r: unknown) => (r as DemoRow).key },
      { header: "Label", cell: (r: unknown) => (r as DemoRow).label },
    ],
  },
};

export const Empty: Story = {
  args: {
    rows: [],
    rowKey: (r: unknown) => (r as DemoRow).id,
    columns: [{ header: "Key", cell: (r: unknown) => (r as DemoRow).key }],
    emptyLabel: "No options yet",
  },
};
