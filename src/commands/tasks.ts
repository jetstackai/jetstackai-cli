import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import { printJson, printTable, bold, dim, green, red, yellow } from "../lib/output.js";

interface TaskSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  portalName?: string;
  progress?: { total: number; completed: number; failed: number };
  createdAt?: string;
}

interface ListTasksResponse {
  items: TaskSummary[];
  total: number;
  hasMore: boolean;
}

export const tasksCommand = createCommand("tasks").description(
  "View background tasks (imports and deployments). Filter by --type (import-assets, deploy-assets) and --status (pending, processing, completed, failed)."
);

tasksCommand
  .command("list")
  .description("List all tasks")
  .option("--type <type>", "Filter by type (import-assets, deploy-assets)")
  .option("--status <status>", "Filter by status (pending, processing, completed, failed)")
  .option("--limit <limit>", "Max results")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (options: {
      type?: string;
      status?: string;
      limit?: string;
      format?: string;
    }) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      const params = new URLSearchParams();
      if (options.type) params.set("type", options.type);
      if (options.status) params.set("status", options.status);
      if (options.limit) params.set("limit", options.limit);
      const qs = params.toString();

      const response = await apiRequest<ListTasksResponse>(
        "GET",
        `/v1/tasks${qs ? `?${qs}` : ""}`
      );
      const items = response.items ?? [];

      if (format === "json") {
        printJson(response);
        return;
      }

      console.log(bold("\nTasks\n"));
      printTable(
        ["ID", "Name", "Type", "Status", "Progress", "Created"],
        items.map((t) => {
          const p = t.progress;
          const progress = p ? `${p.completed}/${p.total} (${p.failed} failed)` : "-";
          const statusColor =
            t.status === "completed" ? green : t.status === "failed" ? red : yellow;
          return [
            t.id,
            t.name,
            t.type,
            statusColor(t.status),
            progress,
            t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "-",
          ];
        })
      );
      console.log(dim(`\nTotal: ${response.total}`));
    }
  );

tasksCommand
  .command("get <id>")
  .description("Get task details")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(async (id: string, options: { format?: string }) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const task = await apiRequest<Record<string, unknown>>(
      "GET",
      `/v1/tasks/${id}`
    );

    printJson(task);
  });
