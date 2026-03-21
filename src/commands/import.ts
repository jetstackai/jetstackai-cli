import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import { printJson, printSuccess, printError, bold, dim, green, red, yellow } from "../lib/output.js";

interface ImportStartResponse {
  task: {
    id: string;
    name: string;
    type: string;
    status: string;
    portalName: string;
    progress: { total: number; completed: number; failed: number };
    createdBy: string;
    createdAt: string;
  };
  message: string;
}

interface TaskResponse {
  id: string;
  name: string;
  type: string;
  status: string;
  portalName?: string;
  progress: { total: number; completed: number; failed: number; inProgress?: number };
  assets?: Record<string, Array<{ assetId: string; name: string; status: string; error?: string }>>;
  createdBy?: { name: string };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Parse --assets flag: "workflows:id1,workflows:id2,forms:id3"
 * Returns { workflows: ["id1","id2"], forms: ["id3"] }
 */
function parseAssetPairs(input: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const pair of input.split(",")) {
    const trimmed = pair.trim();
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) {
      console.error(`Invalid asset format: "${trimmed}". Expected type:id`);
      process.exit(1);
    }
    const type = trimmed.slice(0, colonIdx);
    const id = trimmed.slice(colonIdx + 1);
    if (!result[type]) result[type] = [];
    result[type].push(id);
  }
  return result;
}

export const importCommand = createCommand("import").description(
  "Import assets from a HubSpot portal into your JetStack AI library. Use 'hubspot browse' first to discover asset IDs, then 'import start' to begin import."
);

importCommand
  .command("start")
  .description("Start importing assets from HubSpot")
  .requiredOption("--portal <portalId>", "Portal ID (Firestore document ID)")
  .requiredOption("--assets <assets>", "Comma-separated type:hubspotId pairs")
  .requiredOption("--name <name>", "Import task name")
  .option("--create-module", "Create a module from imported assets")
  .option("--module-title <title>", "Module title (requires --create-module)")
  .option("--module-description <desc>", "Module description")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (options: {
      portal: string;
      assets: string;
      name: string;
      createModule?: boolean;
      moduleTitle?: string;
      moduleDescription?: string;
      format?: string;
    }) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      const assets = parseAssetPairs(options.assets);

      const body: Record<string, unknown> = {
        name: options.name,
        portalId: options.portal,
        assets,
      };

      if (options.createModule) {
        body.createModule = true;
        body.moduleTitle = options.moduleTitle || options.name;
        if (options.moduleDescription) {
          body.moduleDescription = options.moduleDescription;
        }
      }

      const response = await apiRequest<ImportStartResponse>(
        "POST",
        "/v1/import/start",
        body
      );

      if (format === "json") {
        printJson(response);
      } else {
        printSuccess(response.message);
        console.log(`  Task ID:  ${bold(response.task.id)}`);
        console.log(`  Status:   ${response.task.status}`);
        console.log(`  Assets:   ${response.task.progress.total}`);
        console.log(
          dim(`\nTrack progress: jetstackai import status ${response.task.id}`)
        );
      }
    }
  );

importCommand
  .command("status <taskId>")
  .description("Check import task progress")
  .option("--watch", "Poll until complete (every 5s)")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (
      taskId: string,
      options: { watch?: boolean; format?: string }
    ) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      if (options.watch) {
        await watchTask(taskId, format);
      } else {
        const task = await apiRequest<TaskResponse>(
          "GET",
          `/v1/tasks/${taskId}`
        );
        printTaskStatus(task, format);
      }
    }
  );

function printTaskStatus(task: TaskResponse, format: string): void {
  if (format === "json") {
    printJson(task);
    return;
  }

  const p = task.progress;
  const pct = p.total > 0 ? Math.round(((p.completed + p.failed) / p.total) * 100) : 0;
  const statusColor =
    task.status === "completed" ? green : task.status === "failed" ? red : yellow;

  console.log(bold(`\nTask: ${task.name}`));
  console.log(`  ID:       ${task.id}`);
  console.log(`  Type:     ${task.type}`);
  console.log(`  Status:   ${statusColor(task.status)}`);
  console.log(`  Progress: ${p.completed}/${p.total} completed, ${p.failed} failed (${pct}%)`);

  // Show per-asset breakdown if available
  if (task.assets) {
    let hasContent = false;
    for (const [type, items] of Object.entries(task.assets)) {
      if (!items || items.length === 0) continue;
      hasContent = true;
      console.log(`\n  ${bold(type)}:`);
      for (const item of items) {
        const icon =
          item.status === "success" ? green("✓") :
          item.status === "failed" ? red("✗") :
          item.status === "processing" ? yellow("⟳") : dim("○");
        const suffix = item.error ? dim(` (${item.error})`) : "";
        console.log(`    ${icon} ${item.name}${suffix}`);
      }
    }
    if (!hasContent) {
      console.log(dim("\n  No asset details available."));
    }
  }
}

async function watchTask(taskId: string, format: string): Promise<void> {
  const POLL_INTERVAL = 5000;
  const TERMINAL_STATUSES = ["completed", "failed", "cancelled"];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const task = await apiRequest<TaskResponse>(
      "GET",
      `/v1/tasks/${taskId}`
    );

    // Clear screen for fresh output in watch mode
    process.stdout.write("\x1b[2J\x1b[H");
    printTaskStatus(task, format);

    if (TERMINAL_STATUSES.includes(task.status)) {
      console.log(dim("\nTask finished."));
      break;
    }

    console.log(dim(`\nPolling every ${POLL_INTERVAL / 1000}s... (Ctrl+C to stop)`));
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}
