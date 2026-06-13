import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProviderLogoRow } from "./ProviderLogoRow";

const meta: Meta<typeof ProviderLogoRow> = {
  title: "Catalog/ProviderLogoRow",
  component: ProviderLogoRow,
};
export default meta;
type Story = StoryObj<typeof ProviderLogoRow>;

export const Default: Story = {
  render: () => (
    <div className="p-4">
      <ProviderLogoRow
        label="Stream"
        providers={[
          { id: 8, name: "Netflix", logoUrl: "https://image.tmdb.org/t/p/w92/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg" },
          { id: 9, name: "Prime Video", logoUrl: "https://image.tmdb.org/t/p/w92/emthp39XA2YScoYL1p0sdbAH2WA.jpg" },
          { id: 337, name: "Disney+", logoUrl: "https://image.tmdb.org/t/p/w92/7rwgEs15tFwyR9NPQ5vpzxTj19d.jpg" },
        ]}
      />
    </div>
  ),
};

export const NoLogos: Story = {
  render: () => (
    <div className="p-4">
      <ProviderLogoRow
        label="Rent"
        providers={[
          { id: 2, name: "Apple TV", logoUrl: null },
          { id: 3, name: "Vudu", logoUrl: null },
        ]}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="p-4">
      <p className="text-text-muted text-sm">Empty ProviderLogoRow renders nothing:</p>
      <ProviderLogoRow label="Buy" providers={[]} />
    </div>
  ),
};
