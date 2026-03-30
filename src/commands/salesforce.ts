/**
 * Salesforce Commands
 *
 * Manage connected Salesforce organizations.
 */

import { createCommand } from "commander";
import { apiRequest } from "../lib/client.js";
import { requireConfig } from "../lib/config.js";
import { printJson, printTable, printSuccess, printError } from "../lib/output.js";

// =============================================================================
// Types
// =============================================================================

interface SalesforceConnection {
  id: string;
  name: string;
  sfOrgId: string;
  instanceUrl: string;
  isSandbox: boolean;
  status: string;
  connectedBy: string;
  connectedAt: string;
}

interface ListConnectionsResponse {
  items: SalesforceConnection[];
  total: number;
  hasMore: boolean;
  lastId?: string;
}

// =============================================================================
// Commands
// =============================================================================

export const salesforceCommand = createCommand("salesforce")
  .description("Manage connected Salesforce organizations")
  .addHelpText(
    "after",
    `
Examples:
  $ jetstackai salesforce list                    # List all Salesforce connections
  $ jetstackai salesforce list --format table      # List in table format
`
  );

/**
 * jetstackai salesforce list
 */
salesforceCommand
  .command("list")
  .description("List connected Salesforce organizations")
  .option("-f, --format <format>", "Output format: json or table", "")
  .action(async (options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    try {
      const response = await apiRequest<ListConnectionsResponse>(
        "GET",
        "/v1/salesforce/connections"
      );

      if (format === "json") {
        printJson(response);
        return;
      }

      // Table format
      const { items, total } = response;

      if (items.length === 0) {
        printSuccess("No Salesforce connections found.");
        return;
      }

      printTable(
        ["Name", "Org ID", "Instance URL", "Environment", "Status", "Connected By", "Connected At"],
        items.map((c) => [
          c.name,
          c.sfOrgId,
          c.instanceUrl,
          c.isSandbox ? "Sandbox" : "Production",
          c.status,
          c.connectedBy,
          c.connectedAt ? new Date(c.connectedAt).toLocaleDateString() : "—",
        ])
      );

      if (total > items.length) {
        console.log(`\nShowing ${items.length} of ${total} connections.`);
      }
    } catch (err) {
      printError(
        err instanceof Error ? err.message : "Failed to list Salesforce connections"
      );
      process.exit(1);
    }
  });
