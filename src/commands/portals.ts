import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import { printJson, printTable, bold } from "../lib/output.js";

interface Portal {
  id: string;
  name: string;
  portalId: string;
  status: string;
  connected: boolean;
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

    const portals = await apiRequest<Portal[]>("GET", "/v1/portals");

    if (format === "table") {
      console.log(bold("HubSpot Portals\n"));
      printTable(
        ["ID", "Name", "Portal ID", "Status", "Connected"],
        portals.map((p) => [
          p.id,
          p.name,
          p.portalId,
          p.status,
          p.connected ? "Yes" : "No",
        ])
      );
    } else {
      printJson(portals);
    }
  });
