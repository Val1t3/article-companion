import { makeGoogleModel, modelName } from "../config/models.ts";
import type {
  AgentResult,
  ArticleStructure,
  DispatchedSection,
  SectionDiagram,
  Source,
  WrittenSection,
} from "../types/index.ts";

const AGENT = "Writer";
const TIER = "pro" as const;

const TONE_RULES = `
- Write in the first person ("I", "you", "we"), never in the passive voice. Sound like explaining to a smart friend.
- Defend a clear, specific point of view. State your position and back it with evidence; neutral, detached reporting underperforms.
- Be confident: make definitive statements, avoid hedges like "seems" or "perhaps", but pair strong claims with concrete evidence.
- Acknowledge the reader's likely frustration before making your argument; use inclusive language that validates their experience.
- Use plain language by default; short words beat long words. Explain any technical term immediately, never leave jargon unexplained.
`.trim();

const EXPLANATION_RULES = `
- Analogy-first: when introducing a complex or abstract concept, lead with an everyday analogy BEFORE the technical explanation, never after.
- The analogy must come from daily life (objects, routines, common jobs) and map cleanly to the concept in at most 3 sentences, then connect back explicitly ("X works the same way.").
- Give at least one concrete, grounded example per concept, distinct from the analogy (real tools, real scenarios, real numbers), placed after the analogy.
- Calibrate depth for a curious but non-expert reader: what it is (one line), why it matters (one line), how it works (analogy + example). Do not over- or under-explain.
- Use rhetorical questions to pre-empt confusion ("But why does this matter?") and answer them immediately; never leave one hanging.
`.trim();

const FLOW_RULES = `
- Open the section with a micro-hook: a short sentence creating tension or curiosity specific to this section's topic.
- Close the section with a transition bridge: a sentence that lands the takeaway or propels the reader into the next section.
- Maximum 3 lines per paragraph (1-2 lines for key statements). One idea per paragraph; split ruthlessly. Never write a wall of text.
- Vary sentence length deliberately: short sentences (<20 words) for facts and emphasis, longer ones only for nuance. Sentence fragments are allowed for rhetorical effect.
- Use signpost phrases to guide flow ("Now here's the important part...", "But there's a catch.", "So why does this happen?").
- Use smooth, natural transitions. Do not add meta-commentary about the article itself or hollow recap sentences.
`.trim();

const FORMATTING_RULES = `
- Write natural, human-sounding English prose. Avoid AI-tell phrases and generic filler: never use "delve into", "it's important to note", "in today's world", "in conclusion", "navigating the landscape", "unlock", "leverage" (as filler), "game-changer".
- Use **bold** only for key terms or pivotal phrases, 2-3 times per section maximum; never bold a full sentence.
- Favor flowing prose over lists. Use a bullet or numbered list only for genuinely parallel items (features, steps), never for continuous reasoning, and never two lists back to back without a transitional paragraph.
- Use inline code formatting for technical names, file names, and commands (e.g. \`CLAUDE.md\`, \`GPT-4\`).
- Prefer colons and parentheses over em dashes. Use whitespace to create rhythm between paragraphs.
- Output Markdown for the body only. Do NOT repeat the section heading (it is added separately).
`.trim();

const HOOK_RULES = `
- This is the opening section: the first 3-5 sentences must NOT define, summarize, or state a general fact about the topic. They must open a cognitive or emotional gap.
- Open with one of: a personal anecdote with emotional tension, an unexpected admission, a relatable frustration, or a provocative contrast (state what most people believe, then challenge it).
- Use short, punchy sentences, one idea per line, to build rhythm. Do NOT start with a rhetorical question; lead with a statement or a scene.
- End the hook with a one-sentence promise of what the article will deliver. Do not use bullet lists in the hook.
`.trim();

const CONCLUSION_CTA_RULES = `
- This is the closing section. It must NOT summarize or recap the article; the reader just read it. Do not begin with "In conclusion" or "To summarize".
- Elevate the argument: extend it to a broader implication, reframe the whole piece with a new lens, or issue a direct challenge to act or reflect.
- Make the final sentence memorable; it is what the reader carries away. The conclusion, not the CTA, is the emotional peak.
- End with a short call-to-action (under 5 sentences, the only CTA in the article): sincerely thank the reader, invite claps in a non-transactional way, and invite a follow with a brief reason. Keep it a natural close, not an ad.
`.trim();

export async function runWriter(
  structure: ArticleStructure,
  sections: DispatchedSection[],
  sources: Source[],
): Promise<AgentResult<WrittenSection[]>> {
  const start = performance.now();
  console.log(`[${AGENT}] writing ${sections.length} sections...`);

  const model = makeGoogleModel(TIER, 0.8);
  const sourcesById = new Map(sources.map((s) => [s.id, s]));
  const outline = structure.sections.map((s) => `- ${s.heading}`).join("\n");

  const written: WrittenSection[] = [];
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

    // Compose the style rules, layering in position-specific rules: the first
    // section is the article's hook, the last is its conclusion + CTA.
    const isFirst = index === 0;
    const isLast = index === sections.length - 1;
    const styleRules = [
      isFirst ? HOOK_RULES : "",
      TONE_RULES,
      EXPLANATION_RULES,
      FLOW_RULES,
      FORMATTING_RULES,
      isLast ? CONCLUSION_CTA_RULES : "",
    ]
      .filter(Boolean)
      .join("\n");

    const body = await model.invoke(
      `You are an expert writer composing one section of an English article titled ` +
        `"${structure.title}".\n\nFull outline:\n${outline}\n\n` +
        `Write the section "${section.heading}". It should cover roughly ` +
        `${section.estimatedWords} words.\n\nWhat it must convey:\n${section.description}\n\n` +
        `Key points:\n${keyPoints}\n\nBacking sources:\n${refs || "(none)"}\n\n` +
        `Style rules:\n${styleRules}`,
    );

    const text = typeof body.content === "string" ? body.content : String(body.content);
    written.push({ id: section.id, heading: section.heading, markdown: text.trim() });
  }

  console.log(`[${AGENT}] wrote ${written.length} sections.`);

  return {
    agent: AGENT,
    content: written,
    metadata: {
      model: modelName(TIER),
      durationMs: Math.round(performance.now() - start),
      notes: `${written.length} sections written`,
    },
  };
}

/**
 * Assemble the final Markdown article from the written sections, embedding any
 * Mermaid diagram produced by the Diagrammer at the end of its section's body.
 * When an illustration is provided, it is shown between the title and the first
 * section as a relative-linked image.
 */
export function assembleArticle(
  title: string,
  sections: WrittenSection[],
  diagrams: SectionDiagram[],
  illustration?: { fileName: string; altText: string },
): string {
  const diagramById = new Map(diagrams.map((d) => [d.sectionId, d]));

  const blocks = sections.map((section) => {
    let block = `## ${section.heading}\n\n${section.markdown}`;
    const diagram = diagramById.get(section.id);
    if (diagram?.include && diagram.mermaid.trim()) {
      block += `\n\n\`\`\`mermaid\n${diagram.mermaid.trim()}\n\`\`\``;
      if (diagram.caption.trim()) block += `\n\n*${diagram.caption.trim()}*`;
    }
    return block;
  });

  let head = `# ${title}\n\n`;
  if (illustration?.fileName) {
    head += `![${illustration.altText}](${illustration.fileName})\n\n`;
  }

  return `${head}${blocks.join("\n\n")}\n`;
}
