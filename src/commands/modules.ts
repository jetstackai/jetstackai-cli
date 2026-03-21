import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import { printJson, printTable, bold, dim } from "../lib/output.js";

interface ModuleSummary {
  id: string;
  name: string;
  shortDescription?: string;
  type?: string;
  category?: string;
  createdAt?: string;
  assetCount?: number;
}

interface ListModulesResponse {
  items: ModuleSummary[];
  total: number;
  hasMore: boolean;
}

interface ModuleDetail {
  id: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  playbookData?: {
    selectedAssets?: Record<string, string[]>;
  };
  createdBy?: { name: string };
  createdAt?: string;
}

export const modulesCommand = createCommand("modules").description(
  "List and inspect modules (playbooks) — curated collections of assets that can be imported or deployed together."
);

modulesCommand
  .command("list")
  .description("List all modules")
  .option("--limit <limit>", "Max results")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(async (options: { limit?: string; format?: string }) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const params = new URLSearchParams();
    if (options.limit) params.set("limit", options.limit);
    const qs = params.toString();

    const response = await apiRequest<ListModulesResponse>(
      "GET",
      `/v1/modules${qs ? `?${qs}` : ""}`
    );
    const items = response.items ?? [];

    if (format === "json") {
      printJson(response);
      return;
    }

    console.log(bold("\nModules\n"));
    printTable(
      ["ID", "Name", "Type", "Category", "Created"],
      items.map((m) => [
        m.id,
        m.name,
        m.type || "-",
        m.category || "-",
        m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "-",
      ])
    );
    console.log(dim(`\nTotal: ${response.total}`));
  });

modulesCommand
  .command("get <id>")
  .description("Get module details")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(async (id: string, options: { format?: string }) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const module = await apiRequest<ModuleDetail>("GET", `/v1/modules/${id}`);

    if (format === "json") {
      printJson(module);
      return;
    }

    console.log(bold(`\nModule: ${module.name}`));
    console.log(`  ID:          ${module.id}`);
    if (module.description) console.log(`  Description: ${module.description}`);
    if (module.type) console.log(`  Type:        ${module.type}`);
    if (module.category) console.log(`  Category:    ${module.category}`);
    if (module.createdBy) console.log(`  Created By:  ${module.createdBy.name}`);

    // Show asset breakdown
    if (module.playbookData?.selectedAssets) {
      console.log(bold("\n  Assets:"));
      for (const [type, ids] of Object.entries(module.playbookData.selectedAssets)) {
        if (ids && ids.length > 0) {
          console.log(`    ${type}: ${ids.length}`);
        }
      }
    }
  });
