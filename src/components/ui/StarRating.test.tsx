import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StarRating } from "./StarRating";

test("renders max stars as radio options", () => {
  render(<StarRating value={0} onChange={() => {}} />);
  expect(screen.getAllByRole("radio")).toHaveLength(5);
});

test("marks the current value selected", () => {
  render(<StarRating value={3} onChange={() => {}} />);
  expect(screen.getByRole("radio", { name: "3 stars" })).toBeChecked();
});

test("calls onChange with the clicked star", async () => {
  const onChange = vi.fn();
  render(<StarRating value={0} onChange={onChange} />);
  await userEvent.click(screen.getByRole("radio", { name: "4 stars" }));
  expect(onChange).toHaveBeenCalledWith(4);
});

test("readOnly renders no radios", () => {
  render(<StarRating value={3} readOnly />);
  expect(screen.queryAllByRole("radio")).toHaveLength(0);
  expect(screen.getByLabelText("Rated 3 out of 5")).toBeInTheDocument();
});
