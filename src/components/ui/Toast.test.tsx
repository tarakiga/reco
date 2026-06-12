import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";

function Trigger() {
  const toast = useToast();
  return (
    <button onClick={() => toast({ title: "Saved to watchlist", variant: "success" })}>
      Fire
    </button>
  );
}

test("shows a toast and auto-dismisses after 5s", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Fire" }));
  expect(screen.getByText("Saved to watchlist")).toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(5100);
  });
  expect(screen.queryByText("Saved to watchlist")).not.toBeInTheDocument();
  vi.useRealTimers();
});
