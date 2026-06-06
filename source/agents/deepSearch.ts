import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { makeGoogleModel, modelName } from "../config/models.ts";
import type { AgentResult, Source } from "../types/index.ts";

const AGENT = "DeepSearch";
const TIER = "flash";
const TARGET_SOURCES = 15;
const QUERIES_PER_RUN = 5;
const RESULTS_PER_QUERY = 8;

const querySchema = z.object({
  queries: z
    .array(z.string())
    .describe("Focused web-search queries that cover the topic from different angles."),
});

const rankingSchema = z.object({
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string().describe("Why this source is relevant, in one or two sentences."),
        relevance: z.number().min(0).max(1).describe("Relevance score between 0 and 1."),
      }),
    )
    .describe(`The ${TARGET_SOURCES} most relevant, de-duplicated sources, best first.`),
});

interface RawHit {
  title: string;
  url: string;
  content: string;
}

function extractHits(toolOutput: unknown): RawHit[] {
  let payload: any = toolOutput;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return [];
    }
  }
  const results = payload?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r) => r && typeof r.url === "string")
    .map((r) => ({
      title: String(r.title ?? r.url),
      url: String(r.url),
      content: String(r.content ?? ""),
    }));
}

export async function runDeepSearch(prompt: string): Promise<AgentResult<Source[]>> {
  const start = performance.now();
  console.log(`[${AGENT}] expanding prompt into search queries...`);

  const model = makeGoogleModel(TIER, 0.3);

  const queryPlanner = model.withStructuredOutput(querySchema);
  const { queries } = await queryPlanner.invoke(
    `You are a research assistant. Given the article brief below, produce up to ` +
      `${QUERIES_PER_RUN} focused English web-search queries that together cover the ` +
      `topic from complementary angles (definitions, recent developments, expert ` +
      `analysis, concrete examples, counterpoints).\n\nBrief:\n${prompt}`,
  );

  const effectiveQueries = queries.slice(0, QUERIES_PER_RUN);
  console.log(`[${AGENT}] running ${effectiveQueries.length} Tavily searches...`);

  const search = new TavilySearch({ maxResults: RESULTS_PER_QUERY });
  const hitLists = await Promise.all(
    effectiveQueries.map(async (query) => {
      try {
        const out = await search.invoke({ query });
        return extractHits(out);
      } catch (err) {
        console.warn(`[${AGENT}] search failed for "${query}": ${(err as Error).message}`);
        return [];
      }
    }),
  );

  const byUrl = new Map<string, RawHit>();
  for (const hit of hitLists.flat()) {
    if (!byUrl.has(hit.url)) byUrl.set(hit.url, hit);
  }
  const candidates = [...byUrl.values()];
  console.log(`[${AGENT}] ${candidates.length} unique candidate sources collected.`);

  if (candidates.length === 0) {
    throw new Error(`${AGENT}: no sources found. Check TAVILY_API_KEY and connectivity.`);
  }

  const ranker = model.withStructuredOutput(rankingSchema);
  const candidateBlock = candidates
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.url}\n${c.content.slice(0, 400)}`)
    .join("\n\n");
  const { sources } = await ranker.invoke(
    `You are curating sources for an article. From the candidate list below, select ` +
      `the ${TARGET_SOURCES} most relevant and trustworthy sources for this brief, ` +
      `remove duplicates and low-quality results, and rank them best first. Keep the ` +
      `exact URLs.\n\nBrief:\n${prompt}\n\nCandidates:\n${candidateBlock}`,
  );

  const result: Source[] = sources.slice(0, TARGET_SOURCES).map((s, i) => ({
    id: i + 1,
    title: s.title,
    url: s.url,
    snippet: s.snippet,
    relevance: s.relevance,
  }));

  console.log(`[${AGENT}] selected ${result.length} sources.`);
  return {
    agent: AGENT,
    content: result,
    metadata: {
      model: modelName(TIER),
      durationMs: Math.round(performance.now() - start),
      notes: `${effectiveQueries.length} queries, ${candidates.length} candidates -> ${result.length} kept`,
    },
  };
}
