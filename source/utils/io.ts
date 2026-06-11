const PROMPT_FILE = "prompt.md";
const OUTPUT_DIR = "output";

export function dateSlug(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}

export async function readPrompt(): Promise<string> {
  const file = Bun.file(PROMPT_FILE);
  if (!(await file.exists())) {
    throw new Error(
      `Missing ${PROMPT_FILE}. Create it and write your article brief there.`,
    );
  }
  const text = (await file.text()).trim();
  if (!text) {
    throw new Error(`${PROMPT_FILE} is empty. Write your article brief there.`);
  }
  return text;
}

export async function writeArticle(slug: string, markdown: string): Promise<string> {
  const path = `${OUTPUT_DIR}/article-${slug}.md`;
  await Bun.write(path, markdown);
  return path;
}

export async function writeLogs(slug: string, markdown: string): Promise<string> {
  const path = `${OUTPUT_DIR}/logs-${slug}.md`;
  await Bun.write(path, markdown);
  return path;
}

/**
 * Write the article illustration to disk. Returns the absolute-ish output path
 * and the bare `fileName`, which is the relative link used inside the article
 * Markdown (the article and image are siblings in `output/`).
 */
export async function writeIllustration(
  slug: string,
  base64Data: string,
  mimeType: string,
): Promise<{ path: string; fileName: string }> {
  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const fileName = `illustration-${slug}.${ext}`;
  const path = `${OUTPUT_DIR}/${fileName}`;
  await Bun.write(path, Buffer.from(base64Data, "base64"));
  return { path, fileName };
}
