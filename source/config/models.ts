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
