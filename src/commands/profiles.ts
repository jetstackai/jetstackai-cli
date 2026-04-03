import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import {
  printJson,
  printTable,
  printError,
  bold,
  dim,
} from "../lib/output.js";

// ─── Types ─────────────────────────────────────────────────────────────

interface ProfileItem {
  id?: string;
  name: string;
  assetType?: string;
  objectType?: string;
  portalId?: string;
  portalName?: string;
  propertiesReferenced?: string[];
  totalSteps?: number;
  size?: number;
  stageCount?: number;
  meta?: {
    source?: string;
    age?: string;
  };
}

interface SearchProfilesResponse {
  profiles: ProfileItem[];
  total: number;
}

interface ScanProfilesResponse {
  profiles: ProfileItem[];
  total: number;
  meta?: {
    source?: string;
    cachedAt?: string;
    fetchedAt?: string;
    age?: string;
    totalProfiles: number;
    portalName?: string;
  };
}

interface ScanAllProfilesResponse {
  portals: Array<{
    portalId: string;
    portalName: string;
    profiles: ProfileItem[];
    meta: {
      source?: string;
      age?: string;
      totalProfiles: number;
    };
  }>;
  totalProfiles: number;
}

const SCAN_ASSET_TYPES = ["workflows", "lists", "forms", "emails", "pipelines"];

// ─── Command ───────────────────────────────────────────────────────────

export const profilesCommand = createCommand("profiles").description(
  "Search, scan, and inspect asset profiles (workflows, lists, forms, emails, pipelines)"
);

// ─── profiles search ──────────────────────────────────────────────────

profilesCommand
  .command("search")
  .description("Search library asset profiles")
  .option("--type <type>", "Filter by asset type")
  .option("--object-type <objectType>", "Filter by object type")
  .option("--portal <portalId>", "Filter by portal ID")
  .option("--limit <limit>", "Max results")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (options: {
      type?: string;
      objectType?: string;
      portal?: string;
      limit?: string;
      format?: string;
    }) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      const params = new URLSearchParams();
      if (options.type) params.set("type", options.type);
      if (options.objectType) params.set("objectType", options.objectType);
      if (options.portal) params.set("portalId", options.portal);
      if (options.limit) params.set("limit", options.limit);

      const qs = params.toString();
      const path = `/v1/assets/profiles${qs ? `?${qs}` : ""}`;

      const response = await apiRequest<SearchProfilesResponse>("GET", path);
      const items = response.profiles ?? [];

      if (format === "json") {
        printJson(response);
        return;
      }

      console.log(bold(`\nAsset Profiles (${items.length} found)\n`));
      printTable(
        ["Name", "Type", "Object", "Portal", "Properties", "Size"],
        items.map((p) => [
          p.name || "-",
          p.assetType || "-",
          p.objectType || "-",
          p.portalId || "-",
          truncateList(p.propertiesReferenced),
          String(p.totalSteps ?? p.size ?? p.stageCount ?? "-"),
        ])
      );
      console.log(dim(`\nTotal: ${response.total}`));
    }
  );

// ─── profiles scan ───────────────────────────────────────────────────

profilesCommand
  .command("scan <portalId> <assetType>")
  .description("Scan a HubSpot portal for asset profiles (cached 24h)")
  .option("--object-type <objectType>", "Filter by object type")
  .option("--fresh", "Force fresh fetch from HubSpot (bypass cache)")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (
      portalId: string,
      assetType: string,
      options: { objectType?: string; fresh?: boolean; format?: string }
    ) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      if (!SCAN_ASSET_TYPES.includes(assetType)) {
        printError(
          `Unsupported asset type: ${assetType}\nSupported: ${SCAN_ASSET_TYPES.join(", ")}`
        );
        process.exit(1);
      }

      const params = new URLSearchParams();
      if (options.objectType) params.set("objectType", options.objectType);
      if (options.fresh) params.set("fresh", "true");

      const qs = params.toString();
      const path = `/v1/hubspot/${portalId}/${assetType}/profiles${qs ? `?${qs}` : ""}`;

      const response = await apiRequest<ScanProfilesResponse>("GET", path);
      const items = response.profiles ?? [];

      if (format === "json") {
        printJson(response);
        return;
      }

      const source = response.meta?.source === "cache" ? `cache (${response.meta?.age})` : "live";
      console.log(
        bold(`\nProfiles for ${assetType} in portal ${portalId} (${items.length} found, source: ${source})\n`)
      );
      printTable(
        ["Name", "Object Type", "Properties", "Imported"],
        items.map((p) => [
          p.name || "-",
          p.objectType || "-",
          String(p.propertiesReferenced?.length ?? 0),
          p.id ? "yes" : "no",
        ])
      );
      console.log(dim(`\nTotal: ${response.total}`));
    }
  );

// ─── profiles scan-all ──────────────────────────────────────────────

profilesCommand
  .command("scan-all <assetType>")
  .description("Scan all connected portals for asset profiles")
  .option("--object-type <objectType>", "Filter by object type")
  .option("--fresh", "Force fresh fetch from HubSpot (bypass cache)")
  .option("--format <format>", 'Output format: "json" or "table"')
  .action(
    async (
      assetType: string,
      options: { objectType?: string; fresh?: boolean; format?: string }
    ) => {
      const config = requireConfig();
      const format = options.format || config.defaultFormat || "json";

      if (!SCAN_ASSET_TYPES.includes(assetType)) {
        printError(
          `Unsupported asset type: ${assetType}\nSupported: ${SCAN_ASSET_TYPES.join(", ")}`
        );
        process.exit(1);
      }

      const params = new URLSearchParams();
      if (options.objectType) params.set("objectType", options.objectType);
      if (options.fresh) params.set("fresh", "true");

      const qs = params.toString();
      const path = `/v1/hubspot/scan/${assetType}/profiles${qs ? `?${qs}` : ""}`;

      const response = await apiRequest<ScanAllProfilesResponse>("GET", path);

      if (format === "json") {
        printJson(response);
        return;
      }

      console.log(
        bold(`\nProfiles for ${assetType} across all portals (${response.totalProfiles} found)\n`)
      );

      for (const portal of response.portals) {
        if (portal.profiles.length === 0) continue;
        console.log(bold(`  ${portal.portalName} (${portal.profiles.length} profiles)`));
        printTable(
          ["Name", "Object Type", "Properties Referenced"],
          portal.profiles.map((p) => [
            p.name || "-",
            p.objectType || "-",
            String(p.propertiesReferenced?.length ?? 0),
          ])
        );
        console.log("");
      }
      console.log(dim(`Total across all portals: ${response.totalProfiles}`));
    }
  );

// ─── profiles detail ────────────────────────────────────────────────

profilesCommand
  .command("detail <type> <id>")
  .description("Get full asset detail from MongoDB (raw schema + dependencies)")
  .option("--format <format>", 'Output format (always JSON for detail)')
  .action(
    async (
      type: string,
      id: string,
      _options: { format?: string }
    ) => {
      requireConfig();
      const path = `/v1/assets/${type}/${id}/detail`;
      const response = await apiRequest<Record<string, unknown>>("GET", path);
      printJson(response);
    }
  );

// ─── Helpers ────────────────────────────────────────────────────────

function truncateList(items?: string[], maxLen = 40): string {
  if (!items || items.length === 0) return "-";
  const joined = items.join(", ");
  if (joined.length <= maxLen) return joined;
  return joined.slice(0, maxLen - 3) + "...";
}
