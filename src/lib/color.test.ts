import { dominantColor, rgba, FALLBACK_RGB } from "./color";

function pixels(colors: [number, number, number, number][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([r, g, b, a], i) => {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  });
  return out;
}

test("dominantColor favors the vivid color over a black majority", () => {
  // Mostly black with a few vivid red pixels — red should win on weighting.
  const data = pixels([
    [0, 0, 0, 255],
    [0, 0, 0, 255],
    [0, 0, 0, 255],
    [220, 20, 30, 255],
    [220, 20, 30, 255],
  ]);
  const [r, g, b] = dominantColor(data);
  expect(r).toBeGreaterThan(150);
  expect(r).toBeGreaterThan(g);
  expect(r).toBeGreaterThan(b);
});

test("dominantColor ignores transparent pixels", () => {
  const data = pixels([
    [10, 200, 120, 0], // transparent — ignored
    [10, 200, 120, 10], // below alpha threshold — ignored
    [40, 90, 220, 255],
  ]);
  const [, , b] = dominantColor(data);
  expect(b).toBeGreaterThan(150); // the blue pixel dominates
});

test("dominantColor returns fallback for no usable pixels", () => {
  expect(dominantColor(pixels([[0, 0, 0, 0]]))).toEqual(FALLBACK_RGB);
});

test("rgba formats with and without alpha", () => {
  expect(rgba([10, 20, 30])).toBe("rgb(10 20 30)");
  expect(rgba([10, 20, 30], 0.5)).toBe("rgb(10 20 30 / 0.5)");
});
