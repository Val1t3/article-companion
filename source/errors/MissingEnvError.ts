export class MissingEnvError extends Error {
  constructor(missing: string[]) {
    super(
      `Missing required environment variable(s): ${missing.join(", ")}.\n` +
        `Create a .env.local file (see .env.example) with:\n` +
        missing.map((k) => `  ${k}=...`).join("\n"),
    );
    this.name = "MissingEnvError";
  }
}