import "server-only";

// Alias (not a pinned version) so it doesn't get retired out from under us.
const MODEL = "gemini-flash-lite-latest";

// Deliberately CONCISE + NEUTRAL: a verbose expansion over-specifies and drifts
// (e.g. "dorm" → "college, secret societies"), which buries good matches. Keep
// it to the literal subject + direct setting synonyms + broad genre.
const prompt = (q: string) =>
  `Rewrite this vague movie/TV-show memory into ONE concise search phrase (under 25 words). ` +
  `Keep the literal subject and add only direct synonyms for the setting ` +
  `(e.g. dorm = boarding school, dormitory, residence hall) and the broad genre (e.g. comedy, drama). ` +
  `Do NOT invent narrow plot themes (no "secret societies", "academic rivalry") and do NOT narrow the ` +
  `era or age group. No titles, no preamble.\n\nMemory: "${q}"`;

/**
 * Expand a vague scene query to improve semantic recall (bridges vocabulary gaps
 * like "dorm" → "boarding school"). Uses Google Gemini Flash when GEMINI_API_KEY
 * is set; otherwise returns the query unchanged so search still works.
 */
export async function expandSceneQuery(query: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  const q = query.trim();
  if (!key || q.length === 0) return q;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt(q) }] }],
          generationConfig: { maxOutputTokens: 256, temperature: 0.3 },
        }),
      },
    );
    if (!res.ok) return q;
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(" ").trim();
    // Keep the literal query AND the expansion so exact terms aren't diluted away.
    return text ? `${q}. ${text}` : q;
  } catch {
    return q;
  }
}
