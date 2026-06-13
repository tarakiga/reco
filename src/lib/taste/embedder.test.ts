import { FakeEmbedder } from "./embedder";

test("FakeEmbedder returns deterministic unit-length vectors of the right dim", async () => {
  const e = new FakeEmbedder(8);
  const [a1] = await e.embed(["alien horror"], "document");
  const [a2] = await e.embed(["alien horror"], "document");
  const [b] = await e.embed(["romcomedy"], "document");
  expect(a1).toHaveLength(8);
  expect(a1).toEqual(a2); // deterministic
  expect(a1).not.toEqual(b); // content-sensitive
  const norm = Math.hypot(...a1);
  expect(norm).toBeCloseTo(1, 5); // unit length
});

test("FakeEmbedder embeds many in order", async () => {
  const e = new FakeEmbedder(8);
  const out = await e.embed(["a", "b", "c"], "document");
  expect(out).toHaveLength(3);
});
