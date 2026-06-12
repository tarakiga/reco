import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

test("associates label with input", () => {
  render(<Input label="Username" />);
  expect(screen.getByLabelText("Username")).toBeInTheDocument();
});

test("shows error and marks input invalid", () => {
  render(<Input label="Username" error="Already taken" />);
  const input = screen.getByLabelText("Username");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Already taken")).toBeInTheDocument();
  expect(input).toHaveAccessibleDescription("Already taken");
});

test("shows hint when no error", () => {
  render(<Input label="Username" hint="3-20 characters" />);
  expect(screen.getByLabelText("Username")).toHaveAccessibleDescription("3-20 characters");
});
