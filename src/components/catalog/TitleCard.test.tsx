import { render, screen } from "@testing-library/react";
import { TitleCard } from "./TitleCard";

test("renders title, year, and links to detail", () => {
  render(
    <TitleCard
      href="/title/movie/603-the-matrix"
      title="The Matrix"
      year={1999}
      posterUrl="https://image.tmdb.org/t/p/w500/x.jpg"
    />,
  );
  const link = screen.getByRole("link", { name: /The Matrix/ });
  expect(link).toHaveAttribute("href", "/title/movie/603-the-matrix");
  expect(screen.getByText("1999")).toBeInTheDocument();
});

test("renders a placeholder when no poster", () => {
  render(<TitleCard href="/x" title="No Poster" year={null} posterUrl={null} />);
  expect(screen.getByText("No Poster")).toBeInTheDocument();
});
