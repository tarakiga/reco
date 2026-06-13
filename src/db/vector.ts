import { customType } from "drizzle-orm/pg-core";

/** pgvector column. Stores number[] in JS, `[a,b,c]` text on the wire. */
export const vector = (dim: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dim})`;
    },
    toDriver(value: number[]) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string) {
      return value.slice(1, -1).split(",").map(Number);
    },
  });

/** Postgres vector literal for raw SQL (e.g. ANN ordering). */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export const EMBEDDING_DIM = 1024;
