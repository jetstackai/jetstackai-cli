/**
 * Salesforce Commands
 *
 * Browse, import, deploy, and manage Salesforce assets.
 * Mirrors the HubSpot command structure for consistency.
 */

import { createCommand } from "commander";
import { apiRequest } from "../lib/client.js";
import { requireConfig } from "../lib/config.js";
import {
  printJson,
  printTable,
  printSuccess,
  printError,
  bold,
  dim,
} from "../lib/output.js";

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

interface BrowseResponse {
  items: Record<string, unknown>[];
  total: number;
}

interface TaskResponse {
  id: string;
  name: string;
  type: string;
  status: string;
  portalName: string;
  sourcePortalName?: string;
  progress: { total: number; completed: number; failed: number };
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}

interface StartResponse {
  task: TaskResponse;
  message: string;
}

interface MappingStructureResponse {
  recordTypes: MappingItem[];
  users: MappingItem[];
  customObjects: MappingItem[];
  stats: { total: number; required: number };
}

interface MappingItem {
  type: string;
  sourceValue: string;
  displayLabel: string;
  reason: string;
  isMandatory: boolean;
  isAutoResolvable: boolean;
  objectContext?: string;
}

interface MappingDestinationsResponse {
  options: Array<{
    id: string;
    name: string;
    label?: string;
    extra?: string;
  }>;
}

// =============================================================================
// Supported asset types for browse
// =============================================================================

const SF_BROWSE_TYPES = [
  "objects",
  "fields",
  "salesProcesses",
  "leadProcesses",
  "supportProcesses",
  "recordTypes",
  "pageLayouts",
  "flows",
  "reports",
  "dashboards",
  "emailTemplates",
  "letterheads",
  "globalValueSets",
  "standardValueSets",
  "validationRules",
  "pathAssistants",
  "permissionSets",
  "flexiPages",
  "roles",
  "settings",
];

// =============================================================================
// Command Group
// =============================================================================

export const salesforceCommand = createCommand("salesforce")
  .alias("sf")
  .description("Manage Salesforce connections, browse, import, and deploy assets")
  .addHelpText(
    "after",
    `
Salesforce Workflow:
  1. jetstackai salesforce list                          List connected Salesforce orgs
  2. jetstackai salesforce browse <connId> objects        Browse custom objects
  3. jetstackai salesforce browse <connId> salesProcesses Browse sales processes
  4. jetstackai salesforce import start --connection <id> --assets objects:Obj__c,salesProcesses:019... --name "My Import"
  5. jetstackai salesforce import status <taskId> --watch Watch import progress
  6. jetstackai salesforce deploy start --name "Deploy" --target <connId> --assets objects:Obj__c
  7. jetstackai salesforce deploy status <taskId> --watch Watch deploy progress
  8. jetstackai salesforce mapping structure --assets objects:Obj__c
  9. jetstackai salesforce mapping destinations --connection <connId> --type recordTypes

Supported browse types:
  ${SF_BROWSE_TYPES.join(", ")}

Examples:
  $ jetstackai sf list --format table
  $ jetstackai sf browse abc123 objects --format table
  $ jetstackai sf browse abc123 fields --object-type Account
  $ jetstackai sf import start --connection abc123 --assets "objects:JS_Project__c,objects:JS_Task__c" --name "Q1 Import"
  $ jetstackai sf deploy start --name "Prod Deploy" --target def456 --assets "objects:JS_Project__c"
`
  );

// =============================================================================
// salesforce list
// =============================================================================

salesforceCommand
  .command("list")
  .description("List connected Salesforce organizations")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const response = await apiRequest<ListConnectionsResponse>(
      "GET",
      "/v1/salesforce/connections"
    );

    if (format === "json") {
      printJson(response);
      return;
    }

    const { items, total } = response;
    if (items.length === 0) {
      printSuccess("No Salesforce connections found.");
      return;
    }

    console.log(bold(`\nSalesforce Connections (${total})\n`));
    printTable(
      ["ID", "Name", "Org ID", "Environment", "Status", "Connected By"],
      items.map((c) => [
        c.id,
        c.name,
        c.sfOrgId,
        c.isSandbox ? "Sandbox" : "Production",
        c.status,
        c.connectedBy,
      ])
    );
    console.log(dim(`\nTotal: ${total}`));
  });

// =============================================================================
// salesforce browse <connectionId> <assetType>
// =============================================================================

salesforceCommand
  .command("browse <connectionId> <assetType>")
  .description(
    `Browse Salesforce assets. Types: ${SF_BROWSE_TYPES.join(", ")}`
  )
  .option("--object-type <objectType>", "Object API name (for fields)")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (connectionId: string, assetType: string, options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    if (!SF_BROWSE_TYPES.includes(assetType)) {
      printError(
        `Unsupported asset type: ${assetType}\nSupported: ${SF_BROWSE_TYPES.join(", ")}`
      );
      process.exit(1);
    }

    let path = `/v1/salesforce/${connectionId}/${assetType}`;
    if (options.objectType) {
      path += `?objectApiName=${encodeURIComponent(options.objectType)}`;
    }

    const response = await apiRequest<BrowseResponse>("GET", path);
    // API returns data under type-specific keys (e.g., validationRules, standardValueSets)
    // or under 'items' for some types. Normalize to a single array.
    const items: Record<string, unknown>[] =
      response.items ??
      (response as unknown as Record<string, unknown>)[assetType] as Record<string, unknown>[] ??
      [];

    if (format === "json") {
      printJson(response);
      return;
    }

    console.log(bold(`\nSalesforce ${assetType} (${items.length} found)\n`));

    switch (assetType) {
      case "objects":
        printTable(
          ["API Name", "Label", "Custom Fields", "Relationships", "Record Types"],
          items.map((o) => [
            String(o.apiName),
            String(o.label),
            String(o.customFieldCount ?? 0),
            String(o.relationshipCount ?? 0),
            String(o.recordTypeCount ?? 0),
          ])
        );
        break;
      case "fields":
        printTable(
          ["API Name", "Label", "Type", "Required", "Unique"],
          items.map((f) => [
            String(f.apiName),
            String(f.label),
            String(f.type),
            String(f.required ? "Yes" : "No"),
            String(f.unique ? "Yes" : "No"),
          ])
        );
        break;
      case "salesProcesses":
      case "leadProcesses":
      case "supportProcesses":
        // These return { processes: [...] } or { allStages/allStatuses: [...], processes: [...] }
        const processes =
          (response as unknown as { processes?: Record<string, unknown>[] })
            .processes ?? items;
        printTable(
          ["ID", "Name", "Active", "Stages"],
          processes.map((p) => [
            String(p.id),
            String(p.name),
            String(p.isActive ? "Yes" : "No"),
            String(
              Array.isArray(p.stages)
                ? p.stages.length
                : Array.isArray(p.statuses)
                  ? (p.statuses as unknown[]).length
                  : "—"
            ),
          ])
        );
        break;
      case "recordTypes":
        printTable(
          ["ID", "Name", "Label", "Object"],
          items.map((rt) => [
            String(rt.id),
            String(rt.name ?? rt.developerName),
            String(rt.label),
            String(rt.extra ?? rt.sobjectType ?? "—"),
          ])
        );
        break;
      case "pageLayouts": {
        const layouts =
          (response as unknown as { pageLayouts?: Record<string, unknown>[] })
            .pageLayouts ?? items;
        printTable(
          ["Name", "Object", "Full Name", "Namespace"],
          layouts.map((l) => [
            String(l.name),
            String(l.objectApiName ?? "—"),
            String(l.fullName ?? "—"),
            String(l.namespacePrefix ?? "—"),
          ])
        );
        break;
      }
      case "flows": {
        const flows =
          (response as unknown as { flows?: Record<string, unknown>[] })
            .flows ?? items;
        printTable(
          ["API Name", "Label", "Process Type", "Trigger", "Active"],
          flows.map((f) => [
            String(f.developerName ?? f.id),
            String(f.label),
            String(f.processType ?? "—"),
            String(f.triggerType ?? "—"),
            f.isActive ? "Yes" : "No",
          ])
        );
        break;
      }
      case "validationRules":
        printTable(
          ["ID", "Name", "Object", "Active"],
          items.map((v) => [
            String(v.id),
            String(v.validationName),
            String(v.objectApiName ?? "—"),
            String(v.isActive ? "Yes" : "No"),
          ])
        );
        break;
      case "standardValueSets":
        printTable(
          ["Name", "Label", "Values"],
          items.map((s) => [
            String(s.name),
            String(s.label),
            String(s.valueCount ?? 0),
          ])
        );
        break;
      case "globalValueSets":
        printTable(
          ["API Name", "Label", "Description"],
          items.map((g) => [
            String(g.apiName),
            String(g.label),
            String(g.description ?? "—"),
          ])
        );
        break;
      case "pathAssistants":
        printTable(
          ["Name", "Object", "Field", "Active"],
          items.map((p) => [
            String(p.masterLabel ?? p.developerName),
            String(p.targetObject ?? "—"),
            String(p.targetField ?? "—"),
            String(p.isActive ? "Yes" : "No"),
          ])
        );
        break;
      case "permissionSets":
        printTable(
          ["Name", "Label", "Description"],
          items.map((p) => [
            String(p.name),
            String(p.label),
            String(p.description ?? "—"),
          ])
        );
        break;
      case "flexiPages":
        printTable(
          ["API Name", "Label", "Object", "Type"],
          items.map((f) => [
            String(f.developerName),
            String(f.label),
            String(f.objectApiName ?? "—"),
            String(f.type ?? "—"),
          ])
        );
        break;
      case "roles":
        printTable(
          ["API Name", "Name", "Parent"],
          items.map((r) => [
            String(r.developerName),
            String(r.name),
            String(r.parentRoleName ?? "—"),
          ])
        );
        break;
      case "settings":
        printTable(
          ["Type", "Label", "Available"],
          items.map((s) => [
            String(s.settingsType),
            String(s.label),
            String(s.available ? "Yes" : "No"),
          ])
        );
        break;
      default:
        printTable(
          ["ID", "Name"],
          items.map((a) => [String(a.id ?? a.apiName ?? "—"), String(a.name ?? a.label ?? "—")])
        );
    }

    console.log(dim(`\nTotal: ${items.length}`));
  });

// =============================================================================
// salesforce import start / status
// =============================================================================

const sfImportCmd = salesforceCommand
  .command("import")
  .description("Import Salesforce assets into your library");

sfImportCmd
  .command("start")
  .description("Start a Salesforce import")
  .requiredOption("--connection <id>", "Salesforce connection ID")
  .requiredOption(
    "--assets <pairs>",
    'Asset pairs: "objects:Obj__c,salesProcesses:019..."'
  )
  .requiredOption("--name <name>", "Import task name")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    // Parse asset pairs
    const assets = parseAssetPairs(options.assets);

    const body = {
      name: options.name,
      connectionId: options.connection,
      assets,
    };

    const response = await apiRequest<StartResponse>(
      "POST",
      "/v1/salesforce/import/start",
      body
    );

    if (format === "json") {
      printJson(response);
      return;
    }

    printSuccess(`Import started: ${response.task.id}`);
    console.log(`  Name: ${response.task.name}`);
    console.log(`  Status: ${response.task.status}`);
    console.log(`  Assets: ${response.task.progress.total}`);
    console.log(
      dim(`\nWatch progress: jetstackai sf import status ${response.task.id} --watch`)
    );
  });

sfImportCmd
  .command("status <taskId>")
  .description("Check Salesforce import status")
  .option("-w, --watch", "Poll until completion")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (taskId: string, options) => {
    await watchTask(taskId, options);
  });

// =============================================================================
// salesforce deploy start / status
// =============================================================================

const sfDeployCmd = salesforceCommand
  .command("deploy")
  .description("Deploy Salesforce assets to a target org");

sfDeployCmd
  .command("start")
  .description("Start a Salesforce deployment")
  .requiredOption("--name <name>", "Deployment name")
  .requiredOption("--target <id>", "Target Salesforce connection ID")
  .requiredOption(
    "--assets <pairs>",
    'Asset pairs: "objects:Obj__c,salesProcesses:Name"'
  )
  .option("--source <id>", "Source connection ID (auto-detected if omitted)")
  .option("--mapping <json>", "Mapping JSON: { recordTypes: {}, users: {} }")
  .option("--activate-flows", "Deploy flows as Active instead of Draft")
  .option("--validate", "Run pre-flight validation (checkOnly) before deploying")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const assets = parseAssetPairs(options.assets);
    let mapping: Record<string, unknown> | undefined;
    if (options.mapping) {
      try {
        mapping = JSON.parse(options.mapping);
      } catch {
        printError("Invalid --mapping JSON");
        process.exit(1);
      }
    }

    const deployOptions: Record<string, boolean> = {};
    if (options.activateFlows) deployOptions.activateFlows = true;
    if (options.validate) deployOptions.validateBeforeDeploy = true;

    const body = {
      name: options.name,
      sourceConnectionId: options.source || options.target,
      targetConnectionId: options.target,
      assets,
      ...(mapping && { mapping }),
      ...(Object.keys(deployOptions).length > 0 && { deployOptions }),
    };

    const response = await apiRequest<StartResponse>(
      "POST",
      "/v1/salesforce/deploy/start",
      body
    );

    if (format === "json") {
      printJson(response);
      return;
    }

    printSuccess(`Deployment started: ${response.task.id}`);
    console.log(`  Name: ${response.task.name}`);
    console.log(`  Target: ${response.task.portalName}`);
    console.log(`  Assets: ${response.task.progress.total}`);
    console.log(
      dim(`\nWatch progress: jetstackai sf deploy status ${response.task.id} --watch`)
    );
  });

sfDeployCmd
  .command("status <taskId>")
  .description("Check Salesforce deployment status")
  .option("-w, --watch", "Poll until completion")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (taskId: string, options) => {
    await watchTask(taskId, options);
  });

// =============================================================================
// salesforce mapping structure / destinations
// =============================================================================

const sfMappingCmd = salesforceCommand
  .command("mapping")
  .description("Get mapping requirements and destination options");

sfMappingCmd
  .command("structure")
  .description("Get mapping requirements for selected assets")
  .requiredOption(
    "--assets <pairs>",
    'Asset pairs: "objects:Obj__c,salesProcesses:Name"'
  )
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const assets = parseAssetPairs(options.assets);
    const response = await apiRequest<MappingStructureResponse>(
      "POST",
      "/v1/salesforce/mapping/structure",
      { assets }
    );

    if (format === "json") {
      printJson(response);
      return;
    }

    console.log(
      bold(
        `\nMapping Requirements (${response.stats.total} total, ${response.stats.required} required)\n`
      )
    );

    const allItems = [
      ...response.recordTypes.map((i) => ({ ...i, category: "Record Type" })),
      ...response.users.map((i) => ({ ...i, category: "User" })),
      ...response.customObjects.map((i) => ({
        ...i,
        category: "Custom Object",
      })),
    ];

    if (allItems.length === 0) {
      printSuccess("No mapping required — all references auto-resolvable.");
      return;
    }

    printTable(
      ["Category", "Source", "Label", "Mandatory", "Auto-Resolve", "Object"],
      allItems.map((i) => [
        i.category,
        i.sourceValue,
        i.displayLabel,
        i.isMandatory ? "Yes" : "No",
        i.isAutoResolvable ? "Yes" : "No",
        i.objectContext ?? "—",
      ])
    );
  });

sfMappingCmd
  .command("destinations")
  .description("Get available mapping targets from a Salesforce org")
  .requiredOption("--connection <id>", "Target Salesforce connection ID")
  .requiredOption(
    "--type <type>",
    "Destination type: recordTypes, users, or customObjects"
  )
  .option("--object-type <name>", "Object API name (for recordTypes)")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const body: Record<string, string> = {
      connectionId: options.connection,
      type: options.type,
    };
    if (options.objectType) {
      body.objectApiName = options.objectType;
    }

    const response = await apiRequest<MappingDestinationsResponse>(
      "POST",
      "/v1/salesforce/mapping/destinations",
      body
    );

    if (format === "json") {
      printJson(response);
      return;
    }

    const opts = response.options ?? [];
    console.log(bold(`\nDestination ${options.type} (${opts.length} found)\n`));

    printTable(
      ["ID", "Name", "Label", "Context"],
      opts.map((o) => [
        o.id,
        o.name,
        o.label ?? "—",
        o.extra ?? "—",
      ])
    );
    console.log(dim(`\nTotal: ${opts.length}`));
  });

sfMappingCmd
  .command("validate")
  .description("Validate mapping against the target Salesforce org")
  .requiredOption("--target <id>", "Target Salesforce connection ID")
  .requiredOption(
    "--assets <pairs>",
    'Asset pairs: "objects:Obj__c,flows:MyFlow"'
  )
  .requiredOption("--mapping <json>", "Mapping JSON to validate")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const assets = parseAssetPairs(options.assets);
    let mapping: Record<string, unknown>;
    try {
      mapping = JSON.parse(options.mapping);
    } catch {
      printError("Invalid --mapping JSON");
      process.exit(1);
    }

    const response = await apiRequest<{
      validation: {
        isValid: boolean;
        blockers: Array<{ type: string; sourceValue: string; message: string }>;
        warnings: Array<{
          type: string;
          sourceValue: string;
          message: string;
          suggestion?: string;
        }>;
      };
    }>("POST", "/v1/salesforce/mapping/validate", {
      targetConnectionId: options.target,
      assets,
      mapping,
    });

    if (format === "json") {
      printJson(response);
      return;
    }

    const { validation } = response;
    if (validation.isValid) {
      printSuccess("Mapping validation passed — no blockers found.");
    } else {
      printError(
        `Mapping validation failed — ${validation.blockers.length} blocker(s) found.`
      );
    }

    if (validation.blockers.length > 0) {
      console.log(bold("\nBlockers (must fix before deploying):\n"));
      printTable(
        ["Type", "Source", "Message"],
        validation.blockers.map((b) => [b.type, b.sourceValue, b.message])
      );
    }

    if (validation.warnings.length > 0) {
      console.log(bold("\nWarnings:\n"));
      printTable(
        ["Type", "Source", "Message", "Suggestion"],
        validation.warnings.map((w) => [
          w.type,
          w.sourceValue,
          w.message,
          w.suggestion ?? "—",
        ])
      );
    }
  });

// =============================================================================
// salesforce fieldsets list / create / get / delete
// =============================================================================

const sfFieldSetsCmd = salesforceCommand
  .command("fieldsets")
  .description("Manage Salesforce Property Sets (curated field groups)");

sfFieldSetsCmd
  .command("list")
  .description("List all Property Sets")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const response = await apiRequest<{
      items: Record<string, unknown>[];
      total: number;
    }>("GET", "/v1/salesforce/fieldSets");

    if (format === "json") {
      printJson(response);
      return;
    }

    const items = response.items ?? [];
    console.log(bold(`\nProperty Sets (${items.length})\n`));
    printTable(
      ["ID", "Name", "Object", "Fields", "Created By"],
      items.map((fs) => [
        String(fs.id),
        String(fs.label ?? fs.name),
        String(fs.objectApiName),
        String(fs.fieldCount ?? 0),
        String(fs.createdBy ?? "—"),
      ])
    );
  });

sfFieldSetsCmd
  .command("get <id>")
  .description("Get a Property Set by ID")
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (id: string, options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const response = await apiRequest<Record<string, unknown>>(
      "GET",
      `/v1/salesforce/fieldSets/${id}`
    );

    printJson(response);
  });

sfFieldSetsCmd
  .command("delete <id>")
  .description("Delete a Property Set")
  .action(async (id: string) => {
    await apiRequest("DELETE", `/v1/salesforce/fieldSets/${id}`);
    printSuccess(`Property Set ${id} deleted.`);
  });

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse "type:id,type:id" into { type: [id, ...] }
 */
function parseAssetPairs(input: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const pair of input.split(",")) {
    const [type, id] = pair.split(":");
    if (!type || !id) continue;
    if (!result[type]) result[type] = [];
    result[type].push(id);
  }
  return result;
}

/**
 * Watch a task until completion (shared by import/deploy status)
 */
async function watchTask(
  taskId: string,
  options: { watch?: boolean; format?: string }
) {
  const config = requireConfig();
  const format = options.format || config.defaultFormat || "json";

  const fetchStatus = async () =>
    apiRequest<TaskResponse>("GET", `/v1/tasks/${taskId}`);

  let task = await fetchStatus();

  if (!options.watch) {
    if (format === "json") {
      printJson(task);
    } else {
      printTaskTable(task);
    }
    return;
  }

  // Watch mode — poll until terminal
  const terminalStatuses = new Set(["completed", "failed", "cancelled"]);
  while (!terminalStatuses.has(task.status)) {
    if (format !== "json") {
      console.clear();
      printTaskTable(task);
      console.log(dim("\nPolling every 5s... (Ctrl+C to stop)"));
    }
    await new Promise((r) => setTimeout(r, 5000));
    task = await fetchStatus();
  }

  if (format === "json") {
    printJson(task);
  } else {
    console.clear();
    printTaskTable(task);
    if (task.status === "completed") {
      printSuccess("\nTask completed successfully!");
    } else if (task.status === "failed") {
      printError("\nTask failed.");
    }
  }
}

function printTaskTable(task: TaskResponse) {
  console.log(bold(`\nTask: ${task.name}\n`));
  printTable(
    ["Field", "Value"],
    [
      ["ID", task.id],
      ["Type", task.type],
      ["Status", task.status],
      ["Portal", task.portalName],
      ...(task.sourcePortalName
        ? [["Source", task.sourcePortalName]]
        : []),
      ["Total", String(task.progress.total)],
      ["Completed", String(task.progress.completed)],
      ["Failed", String(task.progress.failed)],
      ["Created By", task.createdBy],
      ["Created", fmtDate(task.createdAt)],
      ...(task.completedAt
        ? [["Completed At", fmtDate(task.completedAt)]]
        : []),
    ]
  );
}

function fmtDate(val: unknown): string {
  if (!val) return "—";
  try {
    return new Date(String(val)).toLocaleString();
  } catch {
    return "—";
  }
}
