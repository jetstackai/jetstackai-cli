import { createCommand, type Command } from "commander";
import { printWarning } from "../lib/output.js";

function stubAction(): void {
  printWarning("Command not implemented yet. Coming in the next release.");
}

function addStubSubcommand(
  parent: Command,
  name: string,
  description: string,
  args?: string
): void {
  const cmd = parent.command(args ? `${name} ${args}` : name);
  cmd.description(description);
  cmd.action(stubAction);
}

// Assets
export const assetsCommand = createCommand("assets").description(
  "Manage imported assets"
);
addStubSubcommand(assetsCommand, "list", "List all imported assets");
addStubSubcommand(assetsCommand, "get", "Get asset details by ID", "<id>");
addStubSubcommand(
  assetsCommand,
  "schema",
  "View raw HubSpot schema for an asset",
  "<id>"
);
addStubSubcommand(assetsCommand, "rename", "Rename an asset", "<id> <name>");
addStubSubcommand(assetsCommand, "delete", "Delete an asset", "<id>");

// Modules
export const modulesCommand = createCommand("modules").description(
  "Manage implementation modules"
);
addStubSubcommand(modulesCommand, "list", "List all modules");
addStubSubcommand(modulesCommand, "get", "Get module details by ID", "<id>");
addStubSubcommand(
  modulesCommand,
  "index",
  "View module index structure",
  "<id>"
);
addStubSubcommand(modulesCommand, "create", "Create a new module", "<name>");
addStubSubcommand(modulesCommand, "delete", "Delete a module", "<id>");

// HubSpot
export const hubspotCommand = createCommand("hubspot").description(
  "Interact with HubSpot directly"
);
addStubSubcommand(
  hubspotCommand,
  "browse",
  "Browse HubSpot assets in a portal"
);

// Import
export const importCommand = createCommand("import").description(
  "Import assets from HubSpot"
);
addStubSubcommand(importCommand, "start", "Start importing assets from HubSpot");
addStubSubcommand(
  importCommand,
  "status",
  "Check import task progress",
  "<taskId>"
);
addStubSubcommand(
  importCommand,
  "watch",
  "Watch import progress in real-time",
  "<taskId>"
);

// Deploy
export const deployCommand = createCommand("deploy").description(
  "Deploy assets to target portal"
);
addStubSubcommand(
  deployCommand,
  "start",
  "Start deploying assets to target portal"
);
addStubSubcommand(
  deployCommand,
  "status",
  "Check deployment task progress",
  "<taskId>"
);
addStubSubcommand(
  deployCommand,
  "watch",
  "Watch deployment progress in real-time",
  "<taskId>"
);

// Mapping
export const mappingCommand = createCommand("mapping").description(
  "Manage asset mapping configuration"
);
addStubSubcommand(
  mappingCommand,
  "structure",
  "View mapping structure overview"
);
addStubSubcommand(
  mappingCommand,
  "destinations",
  "View or set mapping destinations"
);
addStubSubcommand(
  mappingCommand,
  "validate",
  "Validate mapping configuration"
);

// Tasks
export const tasksCommand = createCommand("tasks").description(
  "View background tasks"
);
addStubSubcommand(tasksCommand, "list", "List all tasks");
addStubSubcommand(tasksCommand, "get", "Get task details by ID", "<id>");
