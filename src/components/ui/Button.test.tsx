import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

test("renders children and handles click", async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save</Button>);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onClick).toHaveBeenCalledOnce();
});

test("is disabled and announces busy when loading", () => {
  render(<Button loading>Save</Button>);
  const btn = screen.getByRole("button");
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute("aria-busy", "true");
});

test("respects explicit disabled", () => {
  render(<Button disabled>Save</Button>);
  expect(screen.getByRole("button")).toBeDisabled();
});
