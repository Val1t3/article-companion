import type { AgentResult } from "../types/index.ts";

interface LogEntry {
  agent: string;
  input: string;
  output: unknown;
  model: string;
  durationMs: number;
  notes?: string;
}

export class WorkflowLogger {
  private readonly entries: LogEntry[] = [];

  record(result: AgentResult<unknown>, inputSummary: string): void {
    this.entries.push({
      agent: result.agent,
      input: inputSummary,
      output: result.content,
      model: result.metadata.model,
      durationMs: result.metadata.durationMs,
      notes: result.metadata.notes,
    });
  }

  render(prompt: string, slug: string): string {
    const totalMs = this.entries.reduce((n, e) => n + e.durationMs, 0);
    const header = [
      `# Workflow logs — ${slug}`,
      "",
      `Total agent time: ${(totalMs / 1000).toFixed(1)}s`,
      "",
      "## Brief (prompt.md)",
      "",
      "```",
      prompt,
      "```",
      "",
    ].join("\n");

    const body = this.entries
      .map((e) => {
        const rendered =
          typeof e.output === "string"
            ? e.output
            : "```json\n" + JSON.stringify(e.output, null, 2) + "\n```";
        return [
          `## ${e.agent}`,
          "",
          `- Model: \`${e.model}\``,
          `- Duration: ${(e.durationMs / 1000).toFixed(1)}s`,
          ...(e.notes ? [`- Notes: ${e.notes}`] : []),
          "",
          `**Input:** ${e.input}`,
          "",
          "**Output:**",
          "",
          rendered,
          "",
        ].join("\n");
      })
      .join("\n");

    return header + body;
  }
}
