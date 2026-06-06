/**
 * Shared types for the article-companion workflow.
 *
 * The pipeline is a sequence of four agents (DeepSearch -> Architect ->
 * Dispatch -> Writer). Each agent consumes the previous agent's structured
 * output and produces its own, wrapped in an `AgentResult` for logging.
 */

/** A single source discovered by the DeepSearch agent. */
export interface Source {
  /** 1-based index used to reference the source elsewhere (e.g. Dispatch). */
  id: number;
  title: string;
  url: string;
  /** Short extract / summary of why the source is relevant. */
  snippet: string;
  /** Relevance score in [0, 1] as judged by the model. */
  relevance: number;
}

/** A planned section of the article, before any content is attached. */
export interface ArticleSection {
  /** Stable slug-like id, e.g. "introduction". */
  id: string;
  /** The section heading as it will appear in the article. */
  heading: string;
  /** What this section should cover (guidance for downstream agents). */
  description: string;
  /** Rough word budget for this section. */
  estimatedWords: number;
}

/** The logical plan of the article produced by the Architect agent. */
export interface ArticleStructure {
  title: string;
  /** Total target word count for the whole article. */
  targetWordCount: number;
  sections: ArticleSection[];
}

/** A section enriched by Dispatch with the substance it must convey. */
export interface DispatchedSection extends ArticleSection {
  /** Bullet-point facts/ideas to cover (substance, not prose). */
  keyPoints: string[];
  /** Ids of the sources backing this section's content. */
  sourceRefs: number[];
}

/** A fully written section produced by the Writer agent. */
export interface WrittenSection {
  heading: string;
  /** Final Markdown body of the section (without the heading line). */
  markdown: string;
}

/** Metadata attached to every agent run for observability/logging. */
export interface AgentRunMetadata {
  model: string;
  durationMs: number;
  /** Free-form notes the agent wants to surface in the logs. */
  notes?: string;
}

/**
 * The common contract returned by every agent: the structured `content`
 * plus run `metadata`. `T` is the agent-specific payload.
 */
export interface AgentResult<T> {
  agent: string;
  content: T;
  metadata: AgentRunMetadata;
}
