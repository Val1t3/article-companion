import { runDeepSearch } from "./agents/deepSearch.ts";
import { runArchitect } from "./agents/architect.ts";
import { runDispatch } from "./agents/dispatch.ts";
import { runWriter, assembleArticle } from "./agents/writer.ts";
import { runDiagrammer } from "./agents/diagrammer.ts";
import { WorkflowLogger } from "./utils/logger.ts";

export interface WorkflowOutput {
  article: string;
  logs: WorkflowLogger;
}

export async function runWorkflow(prompt: string): Promise<WorkflowOutput> {
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

  const article = assembleArticle(
    architecture.content.title,
    written.content,
    diagrams.content,
  );

  return { article, logs };
}
