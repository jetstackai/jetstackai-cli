/**
 * Salesforce Commands
 *
 * Browse, import, deploy, and manage Salesforce assets.
 * Mirrors the HubSpot command structure for consistency.
 */

import { createCommand } from "commander";
import * as readline from "node:readline";
import { apiRequest } from "../lib/client.js";
import { requireConfig } from "../lib/config.js";
import {
  printJson,
  printTable,
  printSuccess,
  printError,
  printTree,
  bold,
  dim,
  type TreeRenderNode,
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

interface SfPreviewPlanItem {
  assetType: string;
  assetId: string;
}

interface SfPreviewPlanLevel {
  level: number;
  items: SfPreviewPlanItem[];
  kindCounts: Record<string, number>;
}

interface SfPreviewPlan {
  totalAssets: number;
  levelCount: number;
  levels: SfPreviewPlanLevel[];
  unresolved: Array<{ assetType: string; assetId: string; reason: string }>;
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
  /** B.1.2: populated on previewOnly deploy tasks after the dep walk. */
  sfPreviewPlan?: SfPreviewPlan;
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
  // Phase 1
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
  // Phase 2A code/UI tier
  "apexClasses",
  "apexTriggers",
  "visualforcePages",
  "lwcBundles",
  "auraBundles",
  "staticResources",
  // Phase 2A leaf-metadata tier
  "customLabels",
  "customPermissions",
  "compactLayouts",
  // Phase 2A binary tier
  "documents",
  "contentAssets",
  // Phase 2A custom-metadata tier
  "customMetadataTypes",
  "customMetadataRecords",
  // Phase 2B identity + UI tier
  "folders",
  "groups",
  "queues",
  "quickActions",
  "webLinks",
  "listViews",
  "audiences",
  "customTabs",
  "customApplications",
  // Phase 2B communication tier
  "orgWideEmailAddresses",
  "customNotificationTypes",
  // Phase 2B time/data tier
  "businessHours",
  "holidays",
  // Phase 2B identity-integration tier
  "namedCredentials",
  "externalCredentials",
  // Phase 3 — Identity tier
  "profiles",
  "permissionSetGroups",
  "mutingPermissionSets",
  // Phase 3 — Workflow / Approval tier
  "workflowAlerts",
  "workflowFieldUpdates",
  "workflowTasks",
  "workflowOutboundMessages",
  "workflowRules",
  "approvalProcesses",
  // Phase 3 — Rules tier
  "assignmentRules",
  "autoResponseRules",
  "escalationRules",
  "duplicateRules",
  "matchingRules",
  // Phase 4 — Sharing + Analytics tier
  //
  // Only the SObject-backed ones surface here. SharingCriteriaRule /
  // SharingOwnerRule / SharingTerritoryRule / SharingGuestRule and the
  // four Translation sub-types live behind Metadata API listMetadata
  // (not a queryable SObject) — the backend BROWSE_REGISTRY intentionally
  // skips them per `fetchSfGeneric.ts` NOTE. They are still importable
  // via `sf import start --assets sharingCriteriaRules:Object.Rule,...`
  // and the recursive dep walker pulls them in automatically when a
  // depended-on parent gets imported. To add a top-level browse, the
  // backend needs a SOAP listMetadata helper.
  "sharingSets",
  "reportTypes",
  "analyticSnapshots",
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
// salesforce modules preview
// =============================================================================
//
// Read-only walk of the dependency graph stored on each imported asset doc.
// Mirrors the deploy-time dep-walk so users can see what _will_ ship without
// queueing a real Cloud Task. Backend handler: POST /v1/salesforce/modules/preview.

interface SfModulesPreviewTreeNode {
  type: string;
  id: string;
  name?: string;
  label?: string;
  mappingState: "leaf" | "mapping-required" | "auto-resolvable" | "missing";
  truncated?: boolean;
  children: SfModulesPreviewTreeNode[];
}

interface SfModulesPreviewMappingItem {
  type: string;
  sourceValue: string;
  displayLabel: string;
  reason: string;
  isMandatory: boolean;
  isAutoResolvable: boolean;
  objectContext?: string;
}

interface SfModulesPreviewResponse {
  root: {
    type: string;
    id: string;
    name?: string;
    label?: string;
  } | null;
  tree: SfModulesPreviewTreeNode[];
  flatCount: Record<string, number>;
  totalAssets: number;
  mappingsRequired: number;
  mappings: SfModulesPreviewMappingItem[];
  unresolved: Array<{ type: string; ref: string; reason: string }>;
}

const sfModulesCmd = salesforceCommand
  .command("modules")
  .description(
    "Inspect the dep graph of imported Salesforce assets without running a deploy."
  );

sfModulesCmd
  .command("preview")
  .description(
    "Walk the dependency tree of an imported root asset. Reports total assets, mappings required, and unresolved deps that would block a deploy."
  )
  .requiredOption(
    "--root-asset <typeAndId>",
    'Root asset to walk. Format: "<assetType>:<assetId>". Example: "sf_flows:Demo1_Opp_Auto_Assign"'
  )
  .option(
    "--max-depth <n>",
    "Cap recursion depth (default: 5; cycle detection runs independently)"
  )
  .option("-f, --format <format>", "Output format: json or table")
  .action(async (options) => {
    const config = requireConfig();
    const format = options.format || config.defaultFormat || "json";

    const [type, ...idParts] = String(options.rootAsset).split(":");
    const id = idParts.join(":");
    if (!type || !id) {
      printError(
        `Invalid --root-asset "${options.rootAsset}". Expected "<assetType>:<assetId>" (e.g. "sf_flows:Demo1_Opp_Auto_Assign").`
      );
      process.exit(1);
    }

    const body: Record<string, unknown> = { rootAsset: { type, id } };
    if (options.maxDepth) {
      const n = Number(options.maxDepth);
      if (!Number.isFinite(n) || n <= 0) {
        printError(`Invalid --max-depth ${options.maxDepth}`);
        process.exit(1);
      }
      body.maxDepth = n;
    }

    const response = await apiRequest<SfModulesPreviewResponse>(
      "POST",
      "/v1/salesforce/modules/preview",
      body
    );

    if (format === "json") {
      printJson(response);
      return;
    }

    printModulesPreview(response);
  });

function printModulesPreview(r: SfModulesPreviewResponse): void {
  if (!r.root) {
    printError(
      "Root asset not found in library. Run `jetstackai sf import start` to add it first."
    );
    return;
  }

  console.log("");
  console.log(bold("Module preview:"));
  console.log(
    `  Root:       ${r.root.type}:${r.root.id}${
      r.root.name ? dim(` (${r.root.name})`) : ""
    }`
  );
  console.log(
    `  Total:      ${r.totalAssets} asset${r.totalAssets === 1 ? "" : "s"}`
  );
  console.log(
    `  Mappings:   ${r.mappingsRequired} required input${
      r.mappingsRequired === 1 ? "" : "s"
    } before deploy`
  );
  console.log(
    `  Unresolved: ${r.unresolved.length} branch${
      r.unresolved.length === 1 ? "" : "es"
    } missing from library`
  );

  console.log("");
  console.log(bold("Tree:"));
  for (const top of r.tree) {
    printTree(treeNodeToRender(top));
  }

  if (r.unresolved.length > 0) {
    console.log("");
    console.log(bold("Unresolved deps (import these before deploy):"));
    const rows = r.unresolved.map((u) => [u.type, u.ref, u.reason]);
    printTable(["Type", "Ref", "Reason"], rows);
  }

  if (r.mappings.length > 0) {
    console.log("");
    console.log(bold("Required user mappings:"));
    const rows = r.mappings.map((m) => [
      m.type,
      m.sourceValue,
      m.displayLabel,
      m.isMandatory ? "yes" : "no",
      m.isAutoResolvable ? "yes" : "no",
    ]);
    printTable(
      ["Type", "Source", "Display", "Mandatory", "Auto-resolvable"],
      rows
    );
  }

  if (Object.keys(r.flatCount).length > 0) {
    console.log("");
    console.log(bold("Per-type counts:"));
    const rows = Object.entries(r.flatCount)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, String(v)]);
    printTable(["Asset type", "Count"], rows);
  }
}

function treeNodeToRender(node: SfModulesPreviewTreeNode): TreeRenderNode {
  const hintParts: string[] = [];
  if (node.mappingState !== "leaf") hintParts.push(node.mappingState);
  if (node.truncated) hintParts.push("truncated");
  const label = `${node.type}:${node.id}${
    node.name && node.name !== node.id ? dim(` (${node.name})`) : ""
  }`;
  return {
    label,
    hint: hintParts.length > 0 ? `[${hintParts.join(", ")}]` : undefined,
    children: (node.children ?? []).map(treeNodeToRender),
  };
}

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
  .option(
    "--mapping <json>",
    "SfUserMappings JSON. Top-level keys: recordTypes, users, objects, profiles, emailTemplateFolders, emailTemplates, groups (queues land here too), permissionSets, permissionSetIds, groupIds, folders. Each value is a sourceKey→destValue map. groupIds/permissionSetIds are source-SF-ID → target-SF-ID maps used by the Apex hardcoded-ID rewriter (Demo 5)."
  )
  .option("--activate-flows", "Deploy flows as Active instead of Draft")
  .option("--validate", "Run pre-flight validation (checkOnly) before deploying")
  .option(
    "--preview",
    "Dry-run: run transform + dep-walk but skip Metadata API submit. Outputs the level-grouped deploy plan and per-asset preview payload."
  )
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
    if (options.preview) deployOptions.previewOnly = true;

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

    if (options.preview) {
      printSuccess(`Preview started: ${response.task.id}`);
    } else {
      printSuccess(`Deployment started: ${response.task.id}`);
    }
    console.log(`  Name: ${response.task.name}`);
    console.log(`  Target: ${response.task.portalName}`);
    console.log(`  Assets: ${response.task.progress.total}`);
    if (options.preview) {
      console.log(
        dim(
          `\nWatch and inspect plan: jetstackai sf deploy status ${response.task.id} --watch`
        )
      );
    } else {
      console.log(
        dim(`\nWatch progress: jetstackai sf deploy status ${response.task.id} --watch`)
      );
    }
  });

// ---------------------------------------------------------------------------
// B.1.4: `sf deploy interactive` — TTY-driven mapping resolution
// ---------------------------------------------------------------------------

interface InteractiveMappingItem {
  type: string;
  sourceValue: string;
  displayLabel: string;
  reason: string;
  isMandatory: boolean;
  isAutoResolvable: boolean;
  objectContext?: string;
}

interface InteractiveMappingStructureResponse {
  recordTypes?: InteractiveMappingItem[];
  users?: InteractiveMappingItem[];
  customObjects?: InteractiveMappingItem[];
  profiles?: InteractiveMappingItem[];
  emailTemplateFolders?: InteractiveMappingItem[];
  queues?: InteractiveMappingItem[];
  groups?: InteractiveMappingItem[];
  [bucket: string]: InteractiveMappingItem[] | unknown;
}

interface DestinationOption {
  id: string;
  name: string;
  label?: string;
  extra?: string;
}

interface DestinationsResponse {
  options: DestinationOption[];
}

/** Which mapping-structure bucket → destinations endpoint type. */
const BUCKET_TO_DEST_TYPE: Record<string, string> = {
  recordTypes: "recordTypes",
  users: "users",
  customObjects: "customObjects",
  profiles: "profiles",
  emailTemplateFolders: "emailTemplateFolders",
  emailTemplates: "emailTemplates",
  queues: "queues",
  groups: "groups",
  permissionSets: "permissionSets",
  folders: "folders",
};

/**
 * Which mapping-structure bucket → SfUserMappings record key.
 * `groupIds` / `permissionSetIds` are the Demo 5 apex remap fields
 * (rewriter looks up 00G / 0PS by source SF ID, not DevName); the bucket
 * names mirror the structure response so the interactive picker can route
 * cleanly.
 */
const BUCKET_TO_MAPPING_KEY: Record<string, string> = {
  recordTypes: "recordTypes",
  users: "users",
  customObjects: "objects",
  profiles: "profiles",
  emailTemplateFolders: "emailTemplateFolders",
  emailTemplates: "emailTemplates",
  queues: "groups", // queues land in SfUserMappings.groups
  groups: "groups",
  permissionSets: "permissionSets",
  permissionSetIds: "permissionSetIds",
  groupIds: "groupIds",
  folders: "folders",
};

function makeReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Render candidate options + prompt for selection. Supports:
 *   - number (1..N) → pick that candidate
 *   - "s" or empty → skip (only if not mandatory)
 *   - substring → re-filter the list and re-prompt
 */
async function pickDestination(
  rl: readline.Interface,
  item: InteractiveMappingItem,
  candidates: DestinationOption[]
): Promise<DestinationOption | null> {
  let filtered = candidates;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log("");
    console.log(
      `? ${item.displayLabel} (source: ${item.sourceValue})${item.objectContext ? dim(` [on ${item.objectContext}]`) : ""}`
    );
    if (filtered.length === 0) {
      console.log(dim("  (no candidates)"));
    } else {
      const display = filtered.slice(0, 20);
      display.forEach((c, i) => {
        const extra = c.extra ? dim(` — ${c.extra}`) : "";
        const label = c.label && c.label !== c.name ? ` (${c.label})` : "";
        console.log(`  ${i + 1}. ${c.name}${label}${extra}`);
      });
      if (filtered.length > display.length) {
        console.log(dim(`  …and ${filtered.length - display.length} more`));
      }
    }
    const helpText = item.isMandatory
      ? "[number to pick / substring to filter]"
      : "[number to pick / substring to filter / s to skip]";
    const answer = await ask(rl, `  ${helpText} › `);
    if (!answer) {
      if (item.isMandatory) {
        console.log(dim("  This mapping is required."));
        continue;
      }
      return null;
    }
    if (/^[sS]$/.test(answer)) {
      if (item.isMandatory) {
        console.log(dim("  Cannot skip: mapping is required."));
        continue;
      }
      return null;
    }
    const asNum = Number(answer);
    if (Number.isInteger(asNum) && asNum >= 1 && asNum <= filtered.length) {
      return filtered[asNum - 1];
    }
    const lc = answer.toLowerCase();
    const refiltered = candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(lc) ||
        (c.label ?? "").toLowerCase().includes(lc) ||
        (c.extra ?? "").toLowerCase().includes(lc)
    );
    if (refiltered.length === 0) {
      console.log(dim(`  No match for '${answer}'. Showing full list again.`));
      filtered = candidates;
    } else {
      filtered = refiltered;
    }
  }
}

sfDeployCmd
  .command("interactive")
  .description(
    "Walk required cross-org mappings interactively, then start the deploy. Mirrors `deploy start` but replaces --mapping JSON with TTY pickers (B.1.4)."
  )
  .requiredOption("--name <name>", "Deployment name")
  .requiredOption("--target <id>", "Target Salesforce connection ID")
  .requiredOption(
    "--assets <pairs>",
    'Asset pairs: "objects:Obj__c,salesProcesses:Name"'
  )
  .option("--source <id>", "Source connection ID (auto-detected if omitted)")
  .option("--activate-flows", "Deploy flows as Active instead of Draft")
  .option("--validate", "Run pre-flight validation (checkOnly) before deploying")
  .option("--preview", "Resolve mappings interactively but do not deploy")
  .action(async (options) => {
    if (!process.stdin.isTTY) {
      printError(
        "sf deploy interactive requires a TTY. Pipe-friendly mode: use `sf deploy start --mapping <json>` instead."
      );
      process.exit(2);
    }
    requireConfig();

    const assets = parseAssetPairs(options.assets);

    // 1. Get mapping requirements.
    console.log(bold("Resolving mapping requirements..."));
    const structure = await apiRequest<InteractiveMappingStructureResponse>(
      "POST",
      "/v1/salesforce/mapping/structure",
      { assets }
    );

    // 2. For each non-empty bucket with unresolved items, fetch candidates
    //    and prompt the user.
    const rl = makeReadline();
    const mapping: Record<string, Record<string, string>> = {};
    try {
      const buckets = Object.keys(BUCKET_TO_DEST_TYPE);
      for (const bucket of buckets) {
        const itemsRaw = (structure as Record<string, unknown>)[bucket];
        if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) continue;
        const items = itemsRaw as InteractiveMappingItem[];
        const needsResolution = items.filter(
          (it) => !it.isAutoResolvable
        );
        if (needsResolution.length === 0) continue;

        console.log("");
        console.log(
          bold(`${bucket} — ${needsResolution.length} item(s) to map:`)
        );

        // Fetch candidates once per bucket.
        let candidates: DestinationOption[] = [];
        try {
          const destType = BUCKET_TO_DEST_TYPE[bucket];
          const resp = await apiRequest<DestinationsResponse>(
            "POST",
            "/v1/salesforce/mapping/destinations",
            { connectionId: options.target, type: destType }
          );
          candidates = resp.options ?? [];
        } catch (err) {
          console.log(
            dim(
              `  Could not fetch destinations for ${bucket}: ${
                err instanceof Error ? err.message : "unknown error"
              }. Skipping.`
            )
          );
          continue;
        }

        const mappingKey = BUCKET_TO_MAPPING_KEY[bucket] ?? bucket;
        for (const item of needsResolution) {
          const picked = await pickDestination(rl, item, candidates);
          if (picked) {
            mapping[mappingKey] = mapping[mappingKey] ?? {};
            mapping[mappingKey][item.sourceValue] = picked.id;
          }
        }
      }
    } finally {
      rl.close();
    }

    // 3. Submit deploy (or preview).
    const deployOptions: Record<string, boolean> = {};
    if (options.activateFlows) deployOptions.activateFlows = true;
    if (options.validate) deployOptions.validateBeforeDeploy = true;
    if (options.preview) deployOptions.previewOnly = true;

    const body = {
      name: options.name,
      sourceConnectionId: options.source || options.target,
      targetConnectionId: options.target,
      assets,
      ...(Object.keys(mapping).length > 0 && { mapping }),
      ...(Object.keys(deployOptions).length > 0 && { deployOptions }),
    };

    console.log("");
    if (Object.keys(mapping).length === 0) {
      console.log(
        dim("(No mappings collected — submitting deploy without --mapping.)")
      );
    } else {
      console.log(
        dim(
          `Submitting deploy with ${Object.values(mapping).reduce(
            (n, m) => n + Object.keys(m).length,
            0
          )} mapping(s).`
        )
      );
    }
    const response = await apiRequest<StartResponse>(
      "POST",
      "/v1/salesforce/deploy/start",
      body
    );
    printSuccess(
      options.preview
        ? `Preview started: ${response.task.id}`
        : `Deployment started: ${response.task.id}`
    );
    console.log(
      dim(
        `\nWatch progress: jetstackai sf deploy status ${response.task.id} --watch`
      )
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
    "Destination type: recordTypes, users, customObjects, profiles, emailTemplates, emailTemplateFolders, queues, groups, permissionSets, folders"
  )
  .option("--object-type <name>", "Object API name (for recordTypes)")
  .option(
    "--folder-type <kind>",
    "Folder kind filter (for type=folders): Document | Email | Report | Dashboard | EmailTemplate"
  )
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
    if (options.folderType) {
      body.folderType = options.folderType;
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
    // B.1.2: render the preview plan if the task carries one.
    if (task.sfPreviewPlan) {
      printSfPreviewPlan(task.sfPreviewPlan);
    }
  }
}

/**
 * Render the level-grouped Salesforce deploy plan returned by a
 * previewOnly run. Output mirrors the v1.md Demo 3 hero-scene format:
 *   Level 0: GlobalValueSet (1)
 *   Level 1: CustomObject:Deal__c (shell)
 *   ...
 */
function printSfPreviewPlan(plan: SfPreviewPlan): void {
  console.log("");
  console.log(bold("Deploy plan:"));
  console.log(
    dim(`  ${plan.totalAssets} assets, ${plan.levelCount} phases`)
  );
  for (const level of plan.levels) {
    const counts = Object.entries(level.kindCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${k.replace(/^sf_/, "")} (${n})`)
      .join(", ");
    console.log(`  Level ${level.level}: ${counts}`);
  }
  if (plan.unresolved.length > 0) {
    console.log("");
    console.log(bold("Unresolved deps:"));
    for (const u of plan.unresolved) {
      console.log(`  • ${u.assetType}:${u.assetId} — ${u.reason}`);
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
