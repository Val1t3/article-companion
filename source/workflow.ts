import { runDeepSearch } from "./agents/deepSearch.ts";
import { runArchitect } from "./agents/architect.ts";
import { runDispatch } from "./agents/dispatch.ts";
import { runWriter, assembleArticle } from "./agents/writer.ts";
import { runDiagrammer } from "./agents/diagrammer.ts";
import { runIllustrator } from "./agents/illustrator.ts";
import { WorkflowLogger } from "./utils/logger.ts";
import type { ArticleIllustration } from "./types/index.ts";

export interface WorkflowOutput {
  article: string;
  logs: WorkflowLogger;
  /** Generated article illustration, if any (written to disk by the caller). */
  illustration?: ArticleIllustration;
}

export async function runWorkflow(prompt: string, slug: string): Promise<WorkflowOutput> {
  const logs = new WorkflowLogger();

  const search = await runDeepSearch(prompt);
  logs.record(search, "User brief");

  const architecture = await runArchitect(prompt, search.content);
  logs.record(architecture, `Brief + ${search.content.length} sources`);

  const dispatched = await runDispatch(architecture.content, search.content);
  logs.record(
    dispatched,
    `${architecture.content.sections.length} sections + ${search.content.length} sources`,
  );

  const written = await runWriter(architecture.content, dispatched.content, search.content);
  logs.record(written, `${dispatched.content.length} dispatched sections`);

  const diagrams = await runDiagrammer(architecture.content, written.content);
  logs.record(diagrams, `${written.content.length} written sections`);

  const illustration = await runIllustrator(architecture.content, prompt);
  const ill = illustration.content;
  // Redact the base64 payload so it doesn't bloat the debug logs.
  logs.record(
    {
      ...illustration,
      content: {
        ...ill,
        base64Data: ill.base64Data ? `<${ill.base64Data.length} base64 chars omitted>` : "",
      },
    },
    architecture.content.title,
  );

  const illFileName = ill.include
    ? `illustration-${slug}.${ill.mimeType === "image/jpeg" ? "jpg" : "png"}`
    : undefined;

  const article = assembleArticle(
    architecture.content.title,
    written.content,
    diagrams.content,
    illFileName ? { fileName: illFileName, altText: ill.altText } : undefined,
  );

  return { article, logs, illustration: ill };
}
