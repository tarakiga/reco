import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

test("renders nothing when closed", () => {
  render(
    <Modal open={false} onClose={() => {}} title="Confirm">
      Body
    </Modal>,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("renders dialog with title when open", () => {
  render(
    <Modal open onClose={() => {}} title="Confirm">
      Body
    </Modal>,
  );
  expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();
  expect(screen.getByText("Body")).toBeInTheDocument();
});

test("calls onClose on Escape", async () => {
  const onClose = vi.fn();
  render(
    <Modal open onClose={onClose} title="Confirm">
      Body
    </Modal>,
  );
  await userEvent.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledOnce();
});
