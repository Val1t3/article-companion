import { MissingEnvError } from "../errors/MissingEnvError";

export interface Env {
  googleApiKey: string;
  tavilyApiKey: string;
}

export function loadEnv(): Env {
  const googleApiKey = process.env.GOOGLE_API_KEY ?? "";
  const tavilyApiKey = process.env.TAVILY_API_KEY ?? "";

  const missing: string[] = [];
  if (!googleApiKey) missing.push("GOOGLE_API_KEY");
  if (!tavilyApiKey) missing.push("TAVILY_API_KEY");
  if (missing.length > 0) throw new MissingEnvError(missing);

  return { googleApiKey, tavilyApiKey };
}
