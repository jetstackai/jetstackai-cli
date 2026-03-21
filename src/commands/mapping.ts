import { createCommand } from "commander";
import { requireConfig } from "../lib/config.js";
import { apiRequest } from "../lib/client.js";
import { printJson, bold, dim } from "../lib/output.js";

/**
 * Parse --assets flag: "workflows:fsId1,forms:fsId2"
 * Returns { workflows: ["fsId1"], forms: ["fsId2"] }
 */
function parseAssetPairs(input: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const pair of input.split(",")) {
    const trimmed = pair.trim();
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) {
      console.error(`Invalid asset format: "${trimmed}". Expected type:firestoreId`);
      process.exit(1);
    }
    const type = trimmed.slice(0, colonIdx);
    const id = trimmed.slice(colonIdx + 1);
    if (!result[type]) result[type] = [];
    result[type].push(id);
  }
  return result;
}

export const mappingCommand = createCommand("mapping").description(
  "Get mapping requirements and destination options before deploying. 'structure' shows what needs mapping (properties, owners, pipelines); 'destinations' shows available targets in the destination portal."
);

mappingCommand
  .command("structure")
  .description("Get mapping structure for selected assets")
  .requiredOption("--source <portalId>", "Source portal ID (Firestore doc ID)")
  .requiredOption("--target <portalId>", "Target portal ID (Firestore doc ID)")
  .requiredOption("--assets <assets>", "Comma-separated type:firestoreDocId pairs")
  .option("--modules <modules>", "Comma-separated module IDs")
  .action(
    async (options: {
      source: string;
      target: string;
      assets: string;
      modules?: string;
    }) => {
      requireConfig();

      const assets = parseAssetPairs(options.assets);
      const body: Record<string, unknown> = {
        sourcePortalId: options.source,
        targetPortalId: options.target,
        assets,
      };
      if (options.modules) {
        body.modules = options.modules.split(",").map((m) => m.trim());
      }

      const response = await apiRequest<unknown>(
        "POST",
        "/v1/mapping/structure",
        body
      );

      // Always JSON — this is designed for agent consumption
      printJson(response);
    }
  );

mappingCommand
  .command("destinations")
  .description("Get available destination options for mapping")
  .requiredOption("--target <portalId>", "Target portal ID (Firestore doc ID)")
  .requiredOption("--type <assetType>", "Asset type to fetch destinations for")
  .option("--object-type <objectTypeId>", "Object type ID (for properties/pipelines)")
  .option(
    "--from-object <fromObjectTypeId>",
    "From object type (for association labels)"
  )
  .option(
    "--to-object <toObjectTypeId>",
    "To object type (for association labels)"
  )
  .action(
    async (options: {
      target: string;
      type: string;
      objectType?: string;
      fromObject?: string;
      toObject?: string;
    }) => {
      requireConfig();

      const body: Record<string, unknown> = {
        targetPortalId: options.target,
        assetType: options.type,
      };
      if (options.objectType) body.objectTypeId = options.objectType;
      if (options.fromObject) body.fromObjectTypeId = options.fromObject;
      if (options.toObject) body.toObjectTypeId = options.toObject;

      const response = await apiRequest<unknown>(
        "POST",
        "/v1/mapping/destinations",
        body
      );

      printJson(response);
    }
  );
