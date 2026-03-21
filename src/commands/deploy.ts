import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import { printJson, printSuccess, bold, dim, green, red, yellow } from "../lib/output.js";

interface DeployStartResponse {
  task: {
    id: string;
    name: string;
    type: string;
    status: string;
    portalName: string;
    sourcePortalName?: string;
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
  progress: { total: number; completed: number; failed: number; inProgress?: number };
  assets?: Record<string, Array<{ assetId: string; name: string; status: string; error?: string }>>;
}

/**
 * Parse --assets flag: "workflows:fsId1,forms:fsId2"
 */
function parseAssetPairs(input: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const pair of input.split(",")) {
    const trimmed = pair.trim();
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) {
      console.error(`Invalid asset format: "${trimmed}". Expected type:firestoreId`);
      process.exit(1);
    }
    const type = trimmed.slice(0, colonIdx);
    const id = trimmed.slice(colonIdx + 1);
    if (!result[type]) result[type] = [];
    result[type].push(id);
  }
  return result;
}

export const deployCommand = createCommand("deploy").description(
  "Deploy assets from your library to a target HubSpot portal. Use 'mapping structure' and 'mapping destinations' first to build the required mapping, then pass it via --mapping."
);

deployCommand
  .command("start")
  .description("Start deploying assets to target portal")
  .requiredOption("--name <name>", "Deployment task name")
  .requiredOption("--source <portalId>", "Source portal ID (Firestore doc ID)")
  .requiredOption("--target <portalId>", "Target portal ID (Firestore doc ID)")
  .requiredOption("--assets <assets>", "Comma-separated type:firestoreDocId pairs")
  .option("--modules <modules>", "Comma-separated module IDs")
  .option("--properties <properties>", "Comma-separated property set IDs")
  .option("--mapping <mapping>", "Mapping JSON string (UserMappings structure)")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (options: {
      name: string;
      source: string;
      target: string;
      assets: string;
      modules?: string;
      properties?: string;
      mapping?: string;
      format?: string;
    }) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      const assets = parseAssetPairs(options.assets);

      const body: Record<string, unknown> = {
        name: options.name,
        sourcePortalId: options.source,
        targetPortalId: options.target,
        assets,
      };

      if (options.modules) {
        body.modules = options.modules.split(",").map((m) => m.trim());
      }
      if (options.properties) {
        body.properties = options.properties.split(",").map((p) => p.trim());
      }
      if (options.mapping) {
        try {
          body.mapping = JSON.parse(options.mapping);
        } catch {
          console.error("Invalid --mapping JSON. Must be a valid JSON string.");
          process.exit(1);
        }
      }

      const response = await apiRequest<DeployStartResponse>(
        "POST",
        "/v1/deploy/start",
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
          dim(`\nTrack progress: jetstackai deploy status ${response.task.id}`)
        );
      }
    }
  );

deployCommand
  .command("status <taskId>")
  .description("Check deployment task progress")
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
        printDeployStatus(task, format);
      }
    }
  );

function printDeployStatus(task: TaskResponse, format: string): void {
  if (format === "json") {
    printJson(task);
    return;
  }

  const p = task.progress;
  const pct = p.total > 0 ? Math.round(((p.completed + p.failed) / p.total) * 100) : 0;
  const statusColor =
    task.status === "completed" ? green : task.status === "failed" ? red : yellow;

  console.log(bold(`\nDeployment: ${task.name}`));
  console.log(`  ID:       ${task.id}`);
  console.log(`  Status:   ${statusColor(task.status)}`);
  console.log(`  Progress: ${p.completed}/${p.total} completed, ${p.failed} failed (${pct}%)`);

  if (task.assets) {
    for (const [type, items] of Object.entries(task.assets)) {
      if (!items || items.length === 0) continue;
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

    process.stdout.write("\x1b[2J\x1b[H");
    printDeployStatus(task, format);

    if (TERMINAL_STATUSES.includes(task.status)) {
      console.log(dim("\nDeployment finished."));
      break;
    }

    console.log(dim(`\nPolling every ${POLL_INTERVAL / 1000}s... (Ctrl+C to stop)`));
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}
