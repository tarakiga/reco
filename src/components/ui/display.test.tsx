import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";

test("Badge renders its label", () => {
  render(<Badge variant="success">Published</Badge>);
  expect(screen.getByText("Published")).toBeInTheDocument();
});

test("Skeleton is hidden from screen readers", () => {
  const { container } = render(<Skeleton className="h-4 w-32" />);
  expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
});

test("EmptyState renders title, description, and action", () => {
  render(
    <EmptyState
      title="No results"
      description="Try a different search."
      action={<button>Clear filters</button>}
    />,
  );
  expect(screen.getByText("No results")).toBeInTheDocument();
  expect(screen.getByText("Try a different search.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
});
