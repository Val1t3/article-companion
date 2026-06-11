import { IMAGE_MODEL_NAME, makeGoogleImageModel } from "../config/models.ts";
import type { AgentResult, ArticleIllustration, ArticleStructure } from "../types/index.ts";

const AGENT = "Illustrator";

const STYLE_RULES = `
- Hand-drawn look: a pencil-and-ink sketch on off-white paper, as if drawn in a researcher's
  notebook or on a whiteboard. Visible strokes, light cross-hatching, a blueprint/plan feel.
- Show a researcher or thinker sketching out the idea: arrows, annotations, small diagrams and
  schematic shapes that map to the article's theme, like a concept laid out on paper.
- Muted, monochrome or lightly tinted palette (graphite, ink blue, faint accent). No photoreal
  rendering, no glossy 3D, no stock-illustration flat-vector style.
- Do NOT render any readable text, letters, words, captions, or labels in the image; convey the
  idea with imagery alone.
- A single coherent composition that reads well as a wide article header.
`.trim();

/**
 * Find the first inline-image part in a model response and return its base64
 * data + MIME type. Returns null when the response carries no image (e.g. the
 * model replied with text only, or `content` is a plain string).
 */
function extractImage(content: unknown): { base64Data: string; mimeType: string } | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      (block as { type?: string }).type === "inlineData"
    ) {
      const inline = (block as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
      if (inline?.data) {
        return { base64Data: inline.data, mimeType: inline.mimeType || "image/png" };
      }
    }
  }
  return null;
}

/**
 * Generate one hand-drawn-style illustration for the whole article, based on
 * its title and the user brief. Returns the raw image bytes (base64 + MIME) so
 * the workflow can write it to disk and link it from the article. On any
 * failure, or when the model returns no image, falls back to `include: false`
 * and the article is assembled without an illustration.
 */
export async function runIllustrator(
  structure: ArticleStructure,
  brief: string,
): Promise<AgentResult<ArticleIllustration>> {
  const start = performance.now();
  console.log(`[${AGENT}] generating an illustration for "${structure.title}"...`);

  const altText = `Hand-drawn illustration of "${structure.title}"`;
  const none: ArticleIllustration = {
    include: false,
    base64Data: "",
    mimeType: "",
    altText: "",
  };

  const prompt =
    `Create a single illustration that captures the theme of an article titled ` +
    `"${structure.title}".\n\n` +
    `Article brief (for theme only, not to be drawn as text):\n${brief}\n\n` +
    `Style rules:\n${STYLE_RULES}`;

  let result: ArticleIllustration = none;
  try {
    const response = await makeGoogleImageModel().invoke(prompt);
    const image = extractImage(response.content);
    if (image) {
      result = { include: true, ...image, altText };
    } else {
      console.warn(`[${AGENT}] model returned no image; skipping illustration.`);
    }
  } catch (err) {
    console.warn(
      `[${AGENT}] illustration generation failed: ${err instanceof Error ? err.message : err}`,
    );
  }

  console.log(`[${AGENT}] ${result.include ? "illustration generated." : "no illustration."}`);

  return {
    agent: AGENT,
    content: result,
    metadata: {
      model: IMAGE_MODEL_NAME,
      durationMs: Math.round(performance.now() - start),
      notes: result.include ? "illustration generated" : "no image generated",
    },
  };
}
