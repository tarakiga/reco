import { render, screen } from "@testing-library/react";
import { AdminTable } from "./AdminTable";

interface Row { id: string; name: string; }
const rows: Row[] = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
];

test("renders column headers and cell values", () => {
  render(
    <AdminTable
      rows={rows}
      rowKey={(r) => r.id}
      columns={[
        { header: "Name", cell: (r) => r.name },
        { header: "ID", cell: (r) => r.id },
      ]}
    />,
  );
  expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
});

test("renders empty state when no rows", () => {
  render(
    <AdminTable
      rows={[]}
      rowKey={(r: Row) => r.id}
      columns={[{ header: "Name", cell: (r) => r.name }]}
      emptyLabel="Nothing here yet"
    />,
  );
  expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
});
