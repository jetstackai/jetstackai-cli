import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import { printJson, printTable, bold, dim } from "../lib/output.js";

interface AssetSummary {
  id: string;
  name: string;
  assetType?: string;
  portalName?: string;
  createdAt?: string;
  archive?: boolean;
}

interface ListAssetsResponse {
  items: AssetSummary[];
  total: number;
  hasMore: boolean;
  lastId?: string;
}

export const assetsCommand = createCommand("assets").description(
  "List and manage assets in your JetStack AI library. Assets are imported from HubSpot portals. Filter by type: workflows, forms, emails, lists, pipelines, pages, templates, blogPosts, hubdbTables, propertySets."
);

assetsCommand
  .command("list")
  .description("List all imported assets")
  .option("--type <type>", "Filter by asset type (workflows, forms, emails, etc.)")
  .option("--portal <portalId>", "Filter by source portal ID")
  .option("--limit <limit>", "Max results (default 100)")
  .option("--start-after <cursor>", "Pagination cursor")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (options: {
      type?: string;
      portal?: string;
      limit?: string;
      startAfter?: string;
      format?: string;
    }) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      const params = new URLSearchParams();
      if (options.type) params.set("type", options.type);
      if (options.portal) params.set("portalId", options.portal);
      if (options.limit) params.set("limit", options.limit);
      if (options.startAfter) params.set("startAfter", options.startAfter);

      const qs = params.toString();
      const path = `/v1/assets${qs ? `?${qs}` : ""}`;

      const response = await apiRequest<ListAssetsResponse>("GET", path);
      const items = response.items ?? [];

      if (format === "json") {
        printJson(response);
        return;
      }

      console.log(bold("\nLibrary Assets\n"));
      printTable(
        ["ID", "Name", "Type", "Portal", "Imported"],
        items.map((a) => [
          a.id,
          a.name || "-",
          a.assetType || "-",
          a.portalName || "-",
          a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "-",
        ])
      );
      console.log(dim(`\nShowing ${items.length} of ${response.total}${response.hasMore ? " (more available)" : ""}`));
    }
  );
