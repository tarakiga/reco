import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ToastProvider, useToast } from "./Toast";
import { Button } from "./Button";

const meta: Meta<typeof ToastProvider> = { title: "Primitives/Toast", component: ToastProvider };
export default meta;
type Story = StoryObj<typeof ToastProvider>;

function Demo() {
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <Button onClick={() => toast({ title: "Something happened" })}>Info</Button>
      <Button onClick={() => toast({ title: "Saved to watchlist", variant: "success" })}>
        Success
      </Button>
      <Button onClick={() => toast({ title: "Something went wrong", variant: "danger" })}>
        Danger
      </Button>
    </div>
  );
}

export const Interactive: Story = {
  render: () => (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  ),
};
