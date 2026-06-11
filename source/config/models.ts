/**
 * Model factory.
 *
 * Two tiers are used across the pipeline:
 *   - "flash": fast/cheap, for search ranking and dispatching (substance).
 *   - "pro":   higher quality, for planning the structure and final writing.
 *
 * `ChatGoogle` (from @langchain/google) defaults to the Google AI platform
 * when GOOGLE_API_KEY is set, which is what we want (no Vertex/GCP).
 */
import { ChatGoogle } from "@langchain/google";

export type ModelTier = "flash" | "pro";

const MODEL_NAMES: Record<ModelTier, string> = {
  flash: "gemini-2.5-flash",
  pro: "gemini-2.5-pro",
};

/** Returns the concrete Gemini model id used for a given tier. */
export function modelName(tier: ModelTier): string {
  return MODEL_NAMES[tier];
}

export function makeGoogleModel(tier: ModelTier, temperature: number | undefined): ChatGoogle {
  return new ChatGoogle({
    model: MODEL_NAMES[tier],
    temperature,
    maxRetries: 2,
  });
}

/** Gemini model used for image generation (not a text tier). */
export const IMAGE_MODEL_NAME = "gemini-2.5-flash-image";

/**
 * Factory for the image-generation model. Unlike the text tiers, it requests
 * image output via `responseModalities` and uses no temperature / structured
 * output. Reuses the same `GOOGLE_API_KEY` / Google AI platform setup.
 */
export function makeGoogleImageModel(): ChatGoogle {
  return new ChatGoogle({
    model: IMAGE_MODEL_NAME,
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio: "16:9" },
    maxRetries: 2,
  });
}
