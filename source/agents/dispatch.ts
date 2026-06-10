import { z } from "zod";
import { makeGoogleModel, modelName } from "../config/models.ts";
import type {
  AgentResult,
  ArticleStructure,
  DispatchedSection,
  Source,
} from "../types/index.ts";

const AGENT = "Dispatch";
const TIER = "flash" as const;

const dispatchSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().describe("Must match a section id from the provided structure."),
        keyPoints: z
          .array(z.string())
          .describe("Concrete facts/ideas this section must convey. Substance, not prose."),
        sourceRefs: z
          .array(z.number().int())
          .describe("Ids of the sources backing this section's key points."),
      }),
    )
    .describe("One entry per section in the structure, same order."),
});

export async function runDispatch(
  structure: ArticleStructure,
  sources: Source[],
): Promise<AgentResult<DispatchedSection[]>> {
  const start = performance.now();
  console.log(`[${AGENT}] dispatching source material into ${structure.sections.length} sections...`);

  const model = makeGoogleModel(TIER, 0.3);
  const dispatcher = model.withStructuredOutput(dispatchSchema);

  const structureBlock = structure.sections
    .map((s) => `- ${s.id}: ${s.heading} — ${s.description} (~${s.estimatedWords} words)`)
    .join("\n");
  const sourceBlock = sources
    .map((s) => `[${s.id}] ${s.title}\n${s.url}\n${s.snippet}`)
    .join("\n\n");

  const { sections } = await dispatcher.invoke(
    `You are a content editor. Distribute the substance from the sources across the ` +
      `article sections below. For each section, list the concrete key points it must ` +
      `cover and reference the source ids that back them. Spread material sensibly so each ` +
      `section is well supported and there is little overlap. Focus on substance, not ` +
      `writing style. Use only the provided source ids.\n\n` +
      `For every concept a section introduces, include at least one concrete, grounded ` +
      `example among its key points (real tool names, real scenarios, real numbers when ` +
      `possible) rather than a hypothetical one. When a concept is abstract or technical, ` +
      `add a key point flagging that the Writer should open it with an everyday analogy. ` +
      `These are still substance notes, not prose.\n\n` +
      `Sections:\n${structureBlock}\n\nSources:\n${sourceBlock}`,
  );

  const byId = new Map(sections.map((s) => [s.id, s]));
  const validSourceIds = new Set(sources.map((s) => s.id));
  const dispatched: DispatchedSection[] = structure.sections.map((section) => {
    const extra = byId.get(section.id);
    return {
      ...section,
      keyPoints: extra?.keyPoints ?? [],
      sourceRefs: (extra?.sourceRefs ?? []).filter((id) => validSourceIds.has(id)),
    };
  });

  const totalPoints = dispatched.reduce((n, s) => n + s.keyPoints.length, 0);
  console.log(`[${AGENT}] assigned ${totalPoints} key points across sections.`);

  return {
    agent: AGENT,
    content: dispatched,
    metadata: {
      model: modelName(TIER),
      durationMs: Math.round(performance.now() - start),
      notes: `${totalPoints} key points across ${dispatched.length} sections`,
    },
  };
}
