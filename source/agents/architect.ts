import { z } from "zod";
import { makeGoogleModel, modelName } from "../config/models.ts";
import type { AgentResult, ArticleStructure, Source } from "../types/index.ts";

const AGENT = "Architect";
const TIER = "pro" as const;
const DEFAULT_WORDS = 1200;

const TITLE_RULES = `
- The title MUST contain a number, a provocative claim, or an unresolved tension. Vague titles that could describe any article are forbidden.
- Proven formulas: "[Number] [Topic] That [Unexpected Qualifier]", "Why [Topic] Is More [Adjective] Than You Think", "[Number] Most Important [Topic] Explained in Just [Time]".
- The title must open a cognitive gap the reader feels compelled to close, while honestly reflecting a strong angle developed in the article. No empty clickbait.
`.trim();

const STRUCTURE_RULES = `
- Build a clear 3-part arc: Hook -> Body (titled sections) -> Conclusion.
- The FIRST section must be a hook/intro (id like "introduction"): it sets up tension, it does not define or summarize the topic.
- The LAST section must be a conclusion that elevates or reframes the argument and ends with a short call-to-action; it is NOT a recap.
- The reader must grasp the whole article in under 20 seconds by scanning section headings alone, so each heading must carry a standalone idea, not a vague label.
- One core idea per section. Do not merge two unrelated arguments into a single section.
- Aim for ~150-250 words per body section (never plan a section over 400 words).
- The sections must build toward a cumulative payoff, not just list facts.
- Target a 5-8 minute read (roughly 1100-1750 words) when the brief gives no length.
`.trim();

const structureSchema = z.object({
  title: z.string().describe("A compelling English article title."),
  targetWordCount: z
    .number()
    .int()
    .min(1)
    .describe("Total target word count, derived from the brief (default ~1200 if unspecified)."),
  sections: z
    .array(
      z.object({
        id: z.string().describe("Stable slug id, e.g. 'introduction'."),
        heading: z.string().describe("Section heading as it appears in the article."),
        description: z
          .string()
          .describe("What this section must cover. Guidance for downstream agents."),
        estimatedWords: z.number().int().min(1).describe("Word budget for this section."),
      }),
    )
    .min(3)
    .describe("Ordered sections forming a coherent narrative arc."),
});

export async function runArchitect(
  prompt: string,
  sources: Source[],
): Promise<AgentResult<ArticleStructure>> {
  const start = performance.now();
  console.log(`[${AGENT}] designing article structure...`);

  const model = makeGoogleModel(TIER, 0.5);
  const planner = model.withStructuredOutput(structureSchema);

  const sourceDigest = sources
    .map((s) => `[${s.id}] ${s.title} — ${s.snippet}`)
    .join("\n");

  const structure = (await planner.invoke(
    `You are an editorial architect. Design the structure of an English article for the ` +
      `brief below. Produce an ordered set of sections with a coherent narrative arc ` +
      `(hook, development, payoff). Derive the total target word count from the brief; if ` +
      `the brief does not specify a length, use about ${DEFAULT_WORDS} words. Make the sum ` +
      `of section word budgets match the total. Do not write any prose yet.\n\n` +
      `Title rules:\n${TITLE_RULES}\n\nStructure rules:\n${STRUCTURE_RULES}\n\n` +
      `Brief:\n${prompt}\n\nAvailable sources:\n${sourceDigest}`,
  )) as ArticleStructure;

  console.log(
    `[${AGENT}] "${structure.title}" — ${structure.sections.length} sections, ` +
      `~${structure.targetWordCount} words.`,
  );

  return {
    agent: AGENT,
    content: structure,
    metadata: {
      model: modelName(TIER),
      durationMs: Math.round(performance.now() - start),
      notes: `${structure.sections.length} sections, target ${structure.targetWordCount} words`,
    },
  };
}
