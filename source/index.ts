import { loadEnv } from "./config/env.ts";
import { runWorkflow } from "./workflow.ts";
import { dateSlug, readPrompt, writeArticle, writeIllustration, writeLogs } from "./utils/io.ts";

async function main() {
  loadEnv();

  const prompt = await readPrompt();
  const slug = dateSlug();

  console.log(`\n=== article-companion ===`);
  console.log(`Brief: ${prompt.slice(0, 120)}${prompt.length > 120 ? "..." : ""}\n`);

  const { article, logs, illustration } = await runWorkflow(prompt, slug);

  const articlePath = await writeArticle(slug, article);
  const logsPath = await writeLogs(slug, logs.render(prompt, slug));

  let imagePath: string | undefined;
  if (illustration?.include) {
    ({ path: imagePath } = await writeIllustration(
      slug,
      illustration.base64Data,
      illustration.mimeType,
    ));
  }

  console.log(`\nDone.`);
  console.log(`  Article: ${articlePath}`);
  if (imagePath) console.log(`  Image:   ${imagePath}`);
  console.log(`  Logs:    ${logsPath}\n`);
}

main().catch((err) => {
  console.error(`\nWorkflow failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
