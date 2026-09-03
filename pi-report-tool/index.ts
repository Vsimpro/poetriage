import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ReportArtifact = Type.Object({
  mime_type: Type.String({ description: "Artifact MIME type, e.g. text/markdown or application/json." }),
  content: Type.String({ description: "The complete report content." }),
}, {
  additionalProperties: false,
});

const ReportEnvelope = Type.Object({
  schema_version: Type.Number({ description: "Report schema version. Use 1." }),
  task_type: Type.String({ description: "Short task type, e.g. malware_analysis or code_review." }),
  status: Type.Optional(Type.String({ description: "Suggested values: completed, partial, failed." })),
  title: Type.String({ description: "Human-readable report title." }),
  summary: Type.Optional(Type.String({ description: "Short report summary." })),
  artifact: ReportArtifact,
  structured_data: Type.Optional(Type.Any({ description: "Task-specific JSON data. May be any JSON value." })),
  warnings: Type.Optional(Type.Array(Type.String())),
  errors: Type.Optional(Type.Array(Type.String())),
}, {
  additionalProperties: false,
});

function stamp() {
  return new Date().toISOString();
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "report";
}

function normalizeArtifactContent(content: string) {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && typeof parsed.report === "string") {
      return {
        content: parsed.report,
        structuredData: parsed,
        normalized: true,
      };
    }
  } catch {
    // Content is already plain report text.
  }

  return {
    content,
    structuredData: undefined,
    normalized: false,
  };
}

async function writeJsonAtomic(path: string, data: unknown) {
  const temp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

const submitStructuredReport = defineTool({
  name: "submit_structured_report",
  label: "Submit Structured Report",
  description: "Submit the final structured report for the completed task and save it to disk.",
  promptSnippet: "Call submit_structured_report as the final action when the task is complete.",
  promptGuidelines: [
    "Use submit_structured_report as your final action after completing the requested task.",
    "Put the human report in artifact.content and use artifact.mime_type to describe its format.",
    "Put task-specific machine-readable fields in structured_data.",
    "After calling submit_structured_report, do not emit another assistant response in the same turn.",
  ],
  parameters: ReportEnvelope,

  async execute(_toolCallId, params) {
    const reportsDir = join(process.cwd(), "reports");
    const historyDir = join(reportsDir, "history");
    const submittedAt = stamp();
    const artifact = params.artifact as typeof params.artifact & {
      structured_data?: unknown;
      warnings?: string[];
      errors?: string[];
    };
    const normalizedArtifact = normalizeArtifactContent(params.artifact.content);
    const normalizedWarnings = [...(params.warnings ?? [])];
    if (
      normalizedArtifact.normalized ||
      artifact.structured_data !== undefined ||
      artifact.warnings !== undefined ||
      artifact.errors !== undefined
    ) {
      normalizedWarnings.push("Report schema was normalized by submit_structured_report.");
    }
    const cleanReport = {
      schema_version: params.schema_version,
      task_type: params.task_type,
      status: params.status,
      title: params.title,
      summary: params.summary,
      artifact: {
        mime_type: params.artifact.mime_type,
        content: normalizedArtifact.content,
      },
      structured_data: params.structured_data ?? artifact.structured_data ?? normalizedArtifact.structuredData,
      warnings: normalizedWarnings.length ? normalizedWarnings : artifact.warnings,
      errors: params.errors ?? artifact.errors,
    };
    const payload = {
      submitted_at: submittedAt,
      tool: "submit_structured_report",
      provider: null,
      model: null,
      usage: null,
      report: cleanReport,
    };

    await mkdir(historyDir, { recursive: true });

    const timestamp = submittedAt.replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
    const taskType = safeName(params.task_type);
    const historyPath = join(historyDir, `${timestamp}-${taskType}.json`);
    const latestPath = join(reportsDir, "latest.json");

    await writeJsonAtomic(historyPath, payload);
    await writeJsonAtomic(latestPath, payload);

    return {
      content: [{ type: "text", text: `Saved structured report to ${latestPath}` }],
      details: { latestPath, historyPath, submittedAt },
      terminate: true,
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(submitStructuredReport);
}
