import "server-only";

const MODEL = "gemini-2.0-flash";

const prompt = (q: string) =>
  `A user is trying to find a movie or TV show they can't name, describing it vaguely. ` +
  `Rewrite their description into ONE rich search phrase that keeps their literal details and adds ` +
  `closely-related themes, synonyms, setting, era, and genre cues likely to appear in a plot or keyword ` +
  `description (e.g. "dorm" → also "boarding school, dormitory"). Do NOT name specific titles. ` +
  `Under 40 words, one line, no preamble.\n\nDescription: "${q}"`;

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
