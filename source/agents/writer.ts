import { makeGoogleModel, modelName } from "../config/models.ts";
import type {
  AgentResult,
  ArticleStructure,
  DispatchedSection,
  Source,
} from "../types/index.ts";

const AGENT = "Writer";
const TIER = "pro" as const;

const HUMANIZATION_RULES = `
- Write natural, human-sounding English prose. Vary sentence length and rhythm; mix short, punchy sentences with longer ones.
- Avoid AI-tell phrases and generic filler: never use "delve into", "it's important to note", "in today's world", "in conclusion", "navigating the landscape", "unlock", "leverage" (as filler), "game-changer".
- Prefer the active voice and concrete examples over abstract claims.
- Use smooth, natural transitions between ideas. Do not add meta-commentary about the article itself or hollow recap sentences.
- Favor flowing prose over bullet lists; use a list only when it genuinely helps the reader.
- Prefer colons and parentheses over em dashes.
- Keep a consistent tone suited to the article's audience.
- Output Markdown for the body only. Do NOT repeat the section heading (it is added separately).
`.trim();

export async function runWriter(
  structure: ArticleStructure,
  sections: DispatchedSection[],
  sources: Source[],
): Promise<AgentResult<string>> {
  const start = performance.now();
  console.log(`[${AGENT}] writing ${sections.length} sections...`);

  const model = makeGoogleModel(TIER, 0.8);
  const sourcesById = new Map(sources.map((s) => [s.id, s]));
  const outline = structure.sections.map((s) => `- ${s.heading}`).join("\n");

  const writtenBodies: string[] = [];
  for (const [index, section] of sections.entries()) {
    console.log(`[${AGENT}] section ${index + 1}/${sections.length}: ${section.heading}`);

    const keyPoints = section.keyPoints.length
      ? section.keyPoints.map((p) => `- ${p}`).join("\n")
      : "(no specific points assigned; write a coherent section from the description)";
    const refs = section.sourceRefs
      .map((id) => sourcesById.get(id))
      .filter((s): s is Source => Boolean(s))
      .map((s) => `[${s.id}] ${s.title} — ${s.url}`)
      .join("\n");

    const body = await model.invoke(
      `You are an expert writer composing one section of an English article titled ` +
        `"${structure.title}".\n\nFull outline:\n${outline}\n\n` +
        `Write the section "${section.heading}". It should cover roughly ` +
        `${section.estimatedWords} words.\n\nWhat it must convey:\n${section.description}\n\n` +
        `Key points:\n${keyPoints}\n\nBacking sources:\n${refs || "(none)"}\n\n` +
        `Style rules:\n${HUMANIZATION_RULES}`,
    );

    const text = typeof body.content === "string" ? body.content : String(body.content);
    writtenBodies.push(`## ${section.heading}\n\n${text.trim()}`);
  }

  const article = `# ${structure.title}\n\n${writtenBodies.join("\n\n")}\n`;
  console.log(`[${AGENT}] article assembled (${article.split(/\s+/).length} words).`);

  return {
    agent: AGENT,
    content: article,
    metadata: {
      model: modelName(TIER),
      durationMs: Math.round(performance.now() - start),
      notes: `${sections.length} sections written`,
    },
  };
}
