import "server-only";

const MODEL = "claude-haiku-4-5-20251001";

const prompt = (q: string) =>
  `A user is trying to find a movie or TV show they can't name, describing it vaguely. ` +
  `Rewrite their description into ONE rich search phrase that keeps their literal details and adds ` +
  `closely-related themes, synonyms, setting, era, and genre cues likely to appear in a plot or keyword ` +
  `description (e.g. "dorm" → also "boarding school, dormitory"). Do NOT name specific titles. ` +
  `Under 40 words, one line, no preamble.\n\nDescription: "${q}"`;

/**
 * Expand a vague scene query to improve semantic recall (bridges vocabulary gaps
 * like "dorm" → "boarding school"). Uses Anthropic Haiku when ANTHROPIC_API_KEY
 * is set; otherwise returns the query unchanged so search still works.
 */
export async function expandSceneQuery(query: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  const q = query.trim();
  if (!key || q.length === 0) return q;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        messages: [{ role: "user", content: prompt(q) }],
      }),
    });
    if (!res.ok) return q;
    const json = (await res.json()) as { content?: { text?: string }[] };
    const text = json.content?.map((c) => c.text ?? "").join(" ").trim();
    // Keep the literal query AND the expansion so exact terms aren't diluted away.
    return text ? `${q}. ${text}` : q;
  } catch {
    return q;
  }
}
