import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { UpcomingBadge } from "./UpcomingBadge";

describe("UpcomingBadge", () => {
  it("renders no date during server render", () => {
    expect(renderToString(<UpcomingBadge releaseDate="2999-01-01" />)).not.toContain("Jan 1, 2999");
  });

  it("shows the date after mount", () => {
    render(<UpcomingBadge releaseDate="2999-01-01" />);
    expect(screen.getByText("Jan 1, 2999")).toBeInTheDocument();
  });

  it("renders nothing for a past date", () => {
    const { container } = render(<UpcomingBadge releaseDate="2000-01-01" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing without a date", () => {
    const { container } = render(<UpcomingBadge releaseDate={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
