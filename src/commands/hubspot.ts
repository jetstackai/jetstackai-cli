import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import { printJson, printTable, bold, dim } from "../lib/output.js";

const SUPPORTED_TYPES = [
  "workflows",
  "forms",
  "emails",
  "lists",
  "pipelines",
  "pages",
  "templates",
  "blogPosts",
  "hubdbTables",
  "properties",
  "propertyGroups",
  "customObjects",
];

interface BrowseResponse {
  items: Record<string, unknown>[];
  total: number;
}

export const hubspotCommand = createCommand("hubspot").description(
  "Browse assets in connected HubSpot portals (workflows, forms, emails, lists, pipelines, pages, templates, blogPosts, hubdbTables, properties, propertyGroups, customObjects)"
);

hubspotCommand
  .command("browse <portalId> <assetType>")
  .description("Browse HubSpot assets in a portal")
  .option("--object-type <objectType>", "Object type (for properties/pipelines)")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (
      portalId: string,
      assetType: string,
      options: { objectType?: string; format?: string }
    ) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      if (!SUPPORTED_TYPES.includes(assetType)) {
        console.error(
          `Unsupported asset type: ${assetType}\nSupported: ${SUPPORTED_TYPES.join(", ")}`
        );
        process.exit(1);
      }

      let path = `/v1/hubspot/${portalId}/${assetType}`;
      if (options.objectType) {
        path += `?objectType=${encodeURIComponent(options.objectType)}`;
      }

      const response = await apiRequest<BrowseResponse>("GET", path);
      const items = response.items ?? [];

      if (format === "json") {
        printJson(response);
        return;
      }

      // Table format — columns vary by asset type
      console.log(bold(`\nHubSpot ${assetType} (${items.length} found)\n`));

      switch (assetType) {
        case "workflows":
          printTable(
            ["ID", "Name", "Status", "Object Type"],
            items.map((w) => [
              String(w.id),
              String(w.name),
              String(w.status ?? "-"),
              String(w.objectType ?? "-"),
            ])
          );
          break;
        case "forms":
          printTable(
            ["ID", "Name", "Form Type", "Created"],
            items.map((f) => [
              String(f.id),
              String(f.name),
              String(f.formType ?? "-"),
              fmtDate(f.createdAt),
            ])
          );
          break;
        case "emails":
          printTable(
            ["ID", "Name", "Type", "Subject"],
            items.map((e) => [
              String(e.id),
              String(e.name),
              String(e.emailType ?? "-"),
              String(e.subject ?? "-"),
            ])
          );
          break;
        case "pipelines":
          printTable(
            ["ID", "Name", "Object Type", "Stages"],
            items.map((p) => [
              String(p.id),
              String(p.name),
              String(p.objectType ?? "-"),
              String(p.stageCount ?? "-"),
            ])
          );
          break;
        case "properties":
          printTable(
            ["Name", "Label", "Type", "Field Type", "Group"],
            items.map((p) => [
              String(p.name),
              String(p.label ?? "-"),
              String(p.type ?? "-"),
              String(p.fieldType ?? "-"),
              String(p.groupLabel ?? p.groupName ?? "-"),
            ])
          );
          break;
        default:
          printTable(
            ["ID", "Name", "Created"],
            items.map((a) => [
              String(a.id),
              String(a.name),
              fmtDate(a.createdAt),
            ])
          );
      }
      console.log(dim(`\nTotal: ${items.length}`));
    }
  );

function fmtDate(val: unknown): string {
  if (!val) return "-";
  try {
    return new Date(String(val)).toLocaleDateString();
  } catch {
    return "-";
  }
}
