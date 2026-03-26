import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import {
  printJson,
  printTable,
  printSuccess,
  printError,
  bold,
  dim,
  green,
  red,
  yellow,
} from "../lib/output.js";

// ─── Types ─────────────────────────────────────────────────────────────

interface BlockItem {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryDisplayName: string;
  dataPointCount: number;
  layoutType: string;
  isEssential: boolean;
  isDefault: boolean;
  order: number;
  supportedReportTypes: string[];
}

interface ListBlocksResponse {
  blocks: BlockItem[];
  categories: Array<{ id: string; displayName: string; blockCount: number }>;
  total: number;
  essentialCount: number;
  defaultCount: number;
}

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  type: string;
  reportType: string;
  blockCount?: number;
  requiredHubSpotTier: string;
  isActive: boolean;
  createdAt?: string;
}

interface ListTemplatesResponse {
  items: TemplateSummary[];
  total: number;
  hasMore: boolean;
}

interface AuditRunSummary {
  id: string;
  name: string;
  status: string;
  source: string;
  templateName: string;
  portalName: string;
  progress?: {
    totalBlocks: number;
    processedBlocks: number;
    totalDataPoints: number;
    processedDataPoints: number;
  };
  reportId?: string;
  createdAt?: string;
  completedAt?: string;
}

interface ListAuditRunsResponse {
  items: AuditRunSummary[];
  total: number;
  hasMore: boolean;
}

// ─── Command Group ─────────────────────────────────────────────────────

export const auditsCommand = createCommand("audits").description(
  "Run HubSpot audits and retrieve audit data. Use 'list-blocks' to discover blocks, " +
    "'create-template' to build a template, 'run' to start an audit, and 'data' to fetch results."
);

// ─── list-blocks ───────────────────────────────────────────────────────

auditsCommand
  .command("list-blocks")
  .description("List all available audit blocks for template creation")
  .option(
    "--report-type <type>",
    "Filter by report type (SIMPLE = public API, ADVANCED = extension)"
  )
  .option(
    "--category <category>",
    "Filter by category (general, sales, marketing, service, automation, reporting)"
  )
  .option("--essential-only", "Only show essential blocks")
  .option("--default-only", "Only show default blocks")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (options: {
      reportType?: string;
      category?: string;
      essentialOnly?: boolean;
      defaultOnly?: boolean;
      format?: string;
    }) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      const params = new URLSearchParams();
      if (options.reportType) params.set("reportType", options.reportType);
      if (options.category) params.set("category", options.category);
      if (options.essentialOnly) params.set("essentialOnly", "true");
      if (options.defaultOnly) params.set("defaultOnly", "true");
      const qs = params.toString();

      const response = await apiRequest<ListBlocksResponse>(
        "GET",
        `/v1/audit/blocks${qs ? `?${qs}` : ""}`
      );

      if (format === "json") {
        printJson(response);
        return;
      }

      console.log(bold("\nAudit Blocks\n"));
      printTable(
        ["ID", "Name", "Category", "Data Points", "Default", "Report Types"],
        response.blocks.map((b) => [
          b.id,
          b.name,
          b.categoryDisplayName,
          String(b.dataPointCount),
          b.isDefault ? green("yes") : dim("no"),
          b.supportedReportTypes.join(", "),
        ])
      );
      console.log(
        dim(
          `\nTotal: ${response.total} blocks (${response.essentialCount} essential, ${response.defaultCount} default)`
        )
      );
    }
  );

// ─── list-templates ────────────────────────────────────────────────────

auditsCommand
  .command("list-templates")
  .description("List audit templates (JetStack + custom)")
  .option("--limit <limit>", "Max results")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(async (options: { limit?: string; format?: string }) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const params = new URLSearchParams();
    if (options.limit) params.set("limit", options.limit);
    const qs = params.toString();

    const response = await apiRequest<ListTemplatesResponse>(
      "GET",
      `/v1/audit/templates${qs ? `?${qs}` : ""}`
    );

    if (format === "json") {
      printJson(response);
      return;
    }

    const items = response.items ?? [];
    console.log(bold("\nAudit Templates\n"));
    printTable(
      ["ID", "Name", "Type", "Report Type", "Blocks", "Active"],
      items.map((t) => [
        t.id,
        t.name,
        t.type,
        t.reportType,
        String(t.blockCount ?? "-"),
        t.isActive ? green("yes") : red("no"),
      ])
    );
    console.log(dim(`\nTotal: ${response.total}`));
  });

// ─── get-template ──────────────────────────────────────────────────────

auditsCommand
  .command("get-template <id>")
  .description("Get audit template details")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(async (id: string, options: { format?: string }) => {
    requireConfig();
    const template = await apiRequest<Record<string, unknown>>(
      "GET",
      `/v1/audit/templates/${id}`
    );
    printJson(template);
  });

// ─── create-template ───────────────────────────────────────────────────

auditsCommand
  .command("create-template")
  .description(
    "Create a custom audit template. Use 'list-blocks' first to discover block IDs."
  )
  .requiredOption("--name <name>", "Template name")
  .requiredOption(
    "--blocks <blocks>",
    "Comma-separated block IDs (e.g. DEAL_PIPELINE,EMAIL_MARKETING)"
  )
  .requiredOption(
    "--report-type <type>",
    "SIMPLE (public API) or ADVANCED (extension)"
  )
  .option("--description <desc>", "Template description")
  .option("--goals <goals>", "What this audit aims to achieve")
  .option("--branding-id <id>", "Branding config ID")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (options: {
      name: string;
      blocks: string;
      reportType: string;
      description?: string;
      goals?: string;
      brandingId?: string;
      format?: string;
    }) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      const blockIds = options.blocks.split(",").map((b) => b.trim());

      const body: Record<string, unknown> = {
        name: options.name,
        reportType: options.reportType,
        blockIds,
        description: options.description || "",
      };
      if (options.goals) body.goals = options.goals;
      if (options.brandingId) body.brandingId = options.brandingId;

      const response = await apiRequest<Record<string, unknown>>(
        "POST",
        "/v1/audit/templates",
        body
      );

      if (format === "json") {
        printJson(response);
      } else {
        printSuccess(`Template created: ${response.id}`);
        console.log(`  Name:        ${bold(String(response.name))}`);
        console.log(`  Report Type: ${response.reportType}`);
        console.log(`  Blocks:      ${blockIds.length}`);
      }
    }
  );

// ─── run ───────────────────────────────────────────────────────────────

auditsCommand
  .command("run")
  .description(
    "Start an audit on a HubSpot portal. Only SIMPLE templates work via API."
  )
  .requiredOption("--name <name>", "Audit run name")
  .requiredOption(
    "--template <templateId>",
    "Template ID (from list-templates)"
  )
  .requiredOption("--portal <portalId>", "Portal ID (from 'portals list')")
  .option("--branding-id <id>", "Branding config override")
  .option(
    "--audit-mode <mode>",
    "quick (current period) or full (includes trends)",
    "quick"
  )
  .option("--watch", "Poll until audit completes (every 5s)")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (options: {
      name: string;
      template: string;
      portal: string;
      brandingId?: string;
      auditMode?: string;
      watch?: boolean;
      format?: string;
    }) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      const body: Record<string, unknown> = {
        name: options.name,
        templateId: options.template,
        portalId: options.portal,
      };
      if (options.brandingId) body.brandingId = options.brandingId;
      if (options.auditMode) body.auditMode = options.auditMode;

      const response = await apiRequest<AuditRunSummary>(
        "POST",
        "/v1/audit/runs",
        body
      );

      if (format === "json" && !options.watch) {
        printJson(response);
        return;
      }

      if (!options.watch) {
        printSuccess(`Audit started: ${response.id}`);
        console.log(`  Name:     ${bold(response.name)}`);
        console.log(`  Status:   ${yellow(response.status)}`);
        console.log(`  Template: ${response.templateName}`);
        console.log(`  Portal:   ${response.portalName}`);
        console.log(
          dim(`\nTrack progress: jetstackai audits status ${response.id} --watch`)
        );
        return;
      }

      // Watch mode — poll until complete
      await watchAuditRun(response.id, format);
    }
  );

// ─── status ────────────────────────────────────────────────────────────

auditsCommand
  .command("status <auditRunId>")
  .description("Check audit run status and progress")
  .option("--watch", "Poll until complete (every 5s)")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (
      auditRunId: string,
      options: { watch?: boolean; format?: string }
    ) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      if (options.watch) {
        await watchAuditRun(auditRunId, format);
      } else {
        const run = await apiRequest<AuditRunSummary>(
          "GET",
          `/v1/audit/runs/${auditRunId}`
        );
        printAuditRunStatus(run, format);
      }
    }
  );

// ─── data ──────────────────────────────────────────────────────────────

auditsCommand
  .command("data <auditRunId>")
  .description(
    "Fetch full audit report data (blocks, data points, health scores). Audit must be completed."
  )
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(async (auditRunId: string, options: { format?: string }) => {
    requireConfig();

    const data = await apiRequest<Record<string, unknown>>(
      "GET",
      `/v1/audit/runs/${auditRunId}/data`
    );

    printJson(data);
  });

// ─── Helpers ───────────────────────────────────────────────────────────

function printAuditRunStatus(run: AuditRunSummary, format: string): void {
  if (format === "json") {
    printJson(run);
    return;
  }

  const statusColor =
    run.status === "completed"
      ? green
      : run.status === "failed"
        ? red
        : yellow;

  console.log(bold(`\nAudit: ${run.name}`));
  console.log(`  ID:       ${run.id}`);
  console.log(`  Status:   ${statusColor(run.status)}`);
  console.log(`  Template: ${run.templateName}`);
  console.log(`  Portal:   ${run.portalName}`);

  if (run.progress) {
    const p = run.progress;
    const pct =
      p.totalBlocks > 0
        ? Math.round((p.processedBlocks / p.totalBlocks) * 100)
        : 0;
    console.log(
      `  Blocks:   ${p.processedBlocks}/${p.totalBlocks} (${pct}%)`
    );
    console.log(
      `  Points:   ${p.processedDataPoints}/${p.totalDataPoints}`
    );
  }

  if (run.reportId) {
    console.log(`  Report:   ${run.reportId}`);
  }

  if (run.completedAt) {
    console.log(`  Completed: ${new Date(run.completedAt).toLocaleString()}`);
  }
}

async function watchAuditRun(
  auditRunId: string,
  format: string
): Promise<void> {
  const POLL_INTERVAL = 5000;
  const TERMINAL_STATUSES = ["completed", "failed"];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const run = await apiRequest<AuditRunSummary>(
      "GET",
      `/v1/audit/runs/${auditRunId}`
    );

    process.stdout.write("\x1b[2J\x1b[H");
    printAuditRunStatus(run, format);

    if (TERMINAL_STATUSES.includes(run.status)) {
      if (run.status === "completed") {
        console.log(
          dim(`\nFetch results: jetstackai audits data ${auditRunId}`)
        );
      } else {
        printError("Audit failed.");
      }
      break;
    }

    console.log(
      dim(`\nPolling every ${POLL_INTERVAL / 1000}s... (Ctrl+C to stop)`)
    );
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}
