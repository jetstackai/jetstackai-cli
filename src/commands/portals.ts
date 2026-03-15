import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import { printJson, printTable, bold } from "../lib/output.js";

interface Portal {
  id: string;
  name: string;
  portalId: string;
  status: string;
  connectedBy: string;
  connectedAt: string;
  connectionType: string;
}

interface PortalsResponse {
  items: Portal[];
  total: number;
  hasMore: boolean;
}

export const portalsCommand = createCommand("portals").description(
  "Manage HubSpot portals"
);

portalsCommand
  .command("list")
  .description("List connected HubSpot portals")
  .option(
    "--format <format>",
    'Output format: "json" or "table"'
  )
  .action(async (options: { format?: string }) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const response = await apiRequest<PortalsResponse>("GET", "/v1/portals");
    const portals = response.items ?? [];

    if (format === "table") {
      console.log(bold("HubSpot Portals\n"));
      printTable(
        ["Name", "Portal ID", "Status", "Connected By", "Connected At"],
        portals.map((p) => [
          p.name,
          p.portalId,
          p.status,
          p.connectedBy,
          p.connectedAt ? new Date(p.connectedAt).toLocaleDateString() : "-",
        ])
      );
      console.log(`\nTotal: ${response.total} portal(s)`);
    } else {
      printJson(response);
    }
  });
