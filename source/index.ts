import { loadEnv } from "./config/env.ts";
import { runWorkflow } from "./workflow.ts";
import { dateSlug, readPrompt, writeArticle, writeLogs } from "./utils/io.ts";

async function main() {
  loadEnv();

  const prompt = await readPrompt();
  const slug = dateSlug();

  console.log(`\n=== article-companion ===`);
  console.log(`Brief: ${prompt.slice(0, 120)}${prompt.length > 120 ? "..." : ""}\n`);

  const { article, logs } = await runWorkflow(prompt);

  const articlePath = await writeArticle(slug, article);
  const logsPath = await writeLogs(slug, logs.render(prompt, slug));

  console.log(`\nDone.`);
  console.log(`  Article: ${articlePath}`);
  console.log(`  Logs:    ${logsPath}\n`);
}

main().catch((err) => {
  console.error(`\nWorkflow failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
