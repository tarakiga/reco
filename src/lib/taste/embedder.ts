import "server-only";
import { EMBEDDING_DIM } from "@/db/vector";

export type EmbedInputType = "document" | "query";

export interface Embedder {
  readonly model: string;
  embed(texts: string[], inputType: EmbedInputType): Promise<number[][]>;
}

/** Deterministic, network-free embedder for tests/local dev. */
export class FakeEmbedder implements Embedder {
  readonly model = "fake";
  constructor(private dim: number = EMBEDDING_DIM) {}
  async embed(texts: string[], _inputType?: EmbedInputType): Promise<number[][]> {
    return texts.map((t) => unit(seedVector(t, this.dim)));
  }
}

function seedVector(text: string, dim: number): number[] {
  // Simple deterministic hash → pseudo-random components.
  const v = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    v[(c + i) % dim] += ((c * 31 + i) % 17) - 8;
  }
  // Ensure non-zero.
  v[0] += 1;
  return v;
}

function unit(v: number[]): number[] {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

/** Voyage AI embeddings (voyage-3.5, 1024-d). Used in production. */
export class VoyageEmbedder implements Embedder {
  readonly model = "voyage-3.5";
  constructor(private apiKey = process.env.VOYAGE_API_KEY) {}
  async embed(texts: string[], inputType: EmbedInputType): Promise<number[][]> {
    if (!this.apiKey) throw new Error("VOYAGE_API_KEY is not configured");
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        input_type: inputType,
        output_dimension: EMBEDDING_DIM,
      }),
    });
    if (!res.ok) throw new Error(`Voyage embed failed (${res.status})`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

/** Default embedder: Voyage in prod, fake when no key (local/test). */
export function defaultEmbedder(): Embedder {
  return process.env.VOYAGE_API_KEY ? new VoyageEmbedder() : new FakeEmbedder();
}
