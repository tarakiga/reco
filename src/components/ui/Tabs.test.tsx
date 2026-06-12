import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";

const items = [
  { id: "movies", label: "Movies" },
  { id: "tv", label: "TV Shows" },
];

test("marks the active tab selected", () => {
  render(<Tabs items={items} value="tv" onChange={() => {}} />);
  expect(screen.getByRole("tab", { name: "TV Shows" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Movies" })).toHaveAttribute("aria-selected", "false");
});

test("calls onChange with the clicked tab id", async () => {
  const onChange = vi.fn();
  render(<Tabs items={items} value="movies" onChange={onChange} />);
  await userEvent.click(screen.getByRole("tab", { name: "TV Shows" }));
  expect(onChange).toHaveBeenCalledWith("tv");
});
