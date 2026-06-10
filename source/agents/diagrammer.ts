import { z } from "zod";
import { makeGoogleModel, modelName } from "../config/models.ts";
import type {
  AgentResult,
  ArticleStructure,
  SectionDiagram,
  WrittenSection,
} from "../types/index.ts";

const AGENT = "Diagrammer";
const TIER = "pro" as const;

const VISUAL_RULES = `
- A diagram is this article's in-article visual: it works as a "breathing point" that breaks reading fatigue and reinforces comprehension.
- Add a visual only for a major concept, process, or architecture. Every diagram must add information value; a decorative or obvious diagram dilutes credibility, so skip it.
- Keep it focused and readable: a handful of nodes/steps, not a sprawling map. At most one per section.
`.trim();

/** Mermaid diagram-type keywords a valid diagram must start with. */
const MERMAID_KEYWORDS = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "journey",
  "gantt",
  "pie",
  "mindmap",
  "timeline",
  "quadrantChart",
];

const diagramSchema = z.object({
  include: z
    .boolean()
    .describe(
      "True only if a diagram genuinely clarifies a hard concept or the section's logic/flow. " +
        "False for narrative, opinion, or simple sections where a diagram adds nothing.",
    ),
  mermaid: z
    .string()
    .describe(
      "Valid Mermaid source WITHOUT the ```mermaid code fence (e.g. start with 'flowchart TD'). " +
        "Empty string when include is false. Keep it focused: a handful of nodes/steps, not a sprawling map.",
    ),
  caption: z
    .string()
    .describe(
      "A short italic caption (one sentence) describing the diagram. Empty string when include is false.",
    ),
});

/**
 * Strip an accidental ```mermaid / ``` fence the model may have wrapped around
 * the diagram source, and trim surrounding whitespace.
 */
function stripFences(mermaid: string): string {
  return mermaid
    .replace(/^\s*```(?:mermaid)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

/** True if the source plausibly begins with a known Mermaid diagram type. */
function looksLikeMermaid(mermaid: string): boolean {
  const first = mermaid.split(/\s|\n/)[0] ?? "";
  return MERMAID_KEYWORDS.includes(first);
}

/**
 * For each written section, decide whether an explanatory Mermaid diagram helps
 * and, if so, generate one. At most one diagram per section; sections that
 * gain nothing from a diagram are skipped (`include: false`).
 */
export async function runDiagrammer(
  structure: ArticleStructure,
  sections: WrittenSection[],
): Promise<AgentResult<SectionDiagram[]>> {
  const start = performance.now();
  console.log(`[${AGENT}] reviewing ${sections.length} sections for useful diagrams...`);

  const model = makeGoogleModel(TIER, 0.3);
  const drawer = model.withStructuredOutput(diagramSchema);

  const diagrams: SectionDiagram[] = [];
  for (const [index, section] of sections.entries()) {
    console.log(`[${AGENT}] section ${index + 1}/${sections.length}: ${section.heading}`);

    const decision = await drawer.invoke(
      `You add at most ONE explanatory diagram to a section of an English article titled ` +
        `"${structure.title}". Add a Mermaid diagram ONLY when it genuinely helps the reader ` +
        `grasp a hard concept, a process, an architecture, or the logic/flow described in the ` +
        `section. If the section is narrative, opinion, or simple enough to follow in prose, ` +
        `set include to false and leave the other fields empty. Do not force a diagram.\n\n` +
        `When you do include one: emit raw Mermaid source only (no \`\`\` fences), prefer ` +
        `flowchart or sequenceDiagram, keep it focused and directly tied to this section, and ` +
        `write a one-sentence caption.\n\n` +
        `Mermaid syntax rules (must follow exactly, or the diagram will not render):\n` +
        `- ALWAYS wrap a subgraph title in double quotes, e.g. 'subgraph "LLM (Pattern Matching)"', ` +
        `never 'subgraph LLM (Pattern Matching)'. This is required whenever the title contains a ` +
        `space, parenthesis, or any non-alphanumeric character.\n` +
        `- Likewise, wrap any node label that contains spaces or special characters in double quotes ` +
        `inside its brackets, e.g. A["Input: drop a glass"].\n` +
        `- Use only plain ASCII node ids (letters/digits) and keep ids distinct from labels.\n\n` +
        `Visual rules:\n${VISUAL_RULES}\n\n` +
        `Section heading: ${section.heading}\n\nSection prose:\n${section.markdown}`,
    );

    let include = decision.include;
    let mermaid = include ? stripFences(decision.mermaid) : "";
    let caption = include ? decision.caption.trim() : "";

    // Guard against broken syntax slipping into the article.
    if (include && (!mermaid || !looksLikeMermaid(mermaid))) {
      console.warn(`[${AGENT}] dropping invalid diagram for "${section.heading}".`);
      include = false;
      mermaid = "";
      caption = "";
    }

    diagrams.push({ sectionId: section.id, include, mermaid, caption });
  }

  const kept = diagrams.filter((d) => d.include).length;
  console.log(`[${AGENT}] added ${kept}/${sections.length} diagrams.`);

  return {
    agent: AGENT,
    content: diagrams,
    metadata: {
      model: modelName(TIER),
      durationMs: Math.round(performance.now() - start),
      notes: `${kept}/${sections.length} sections got a diagram`,
    },
  };
}
