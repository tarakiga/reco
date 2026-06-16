import "server-only";
import { cacheLife } from "next/cache";

// Alias (not a pinned version) so it doesn't get retired out from under us.
const MODEL = "gemini-flash-lite-latest";

const prompt = (q: string) =>
  `A user searched for a movie or TV show title but probably misspelled it. ` +
  `Reply with ONLY the correctly-spelled title you think they meant — nothing else, no quotes, no preamble. ` +
  `If it already looks correct or you can't tell, reply with the exact original text.\n\nSearch: "${q}"`;

/**
 * Best-effort spell-correction for a title search using Google Gemini. Returns
 * the corrected title, or null when unavailable / unchanged. Cached per query
 * (corrections are stable), and degrades to null when GEMINI_API_KEY is unset so
 * search keeps working.
 */
export async function correctTitleQuery(query: string): Promise<string | null> {
  "use cache";
  cacheLife("weeks");
  const key = process.env.GEMINI_API_KEY;
  const q = query.trim();
  if (!key || q.length < 4) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt(q) }] }],
          generationConfig: { maxOutputTokens: 32, temperature: 0 },
        }),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(" ").trim();
    const corrected = text?.replace(/^["']|["']$/g, "").trim();
    if (!corrected || corrected.toLowerCase() === q.toLowerCase()) return null;
    return corrected;
  } catch {
    return null;
  }
}
