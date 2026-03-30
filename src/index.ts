#!/usr/bin/env node

import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { portalsCommand } from "./commands/portals.js";
import { hubspotCommand } from "./commands/hubspot.js";
import { importCommand } from "./commands/import.js";
import { assetsCommand } from "./commands/assets.js";
import { modulesCommand } from "./commands/modules.js";
import { deployCommand } from "./commands/deploy.js";
import { mappingCommand } from "./commands/mapping.js";
import { tasksCommand } from "./commands/tasks.js";
import { auditsCommand } from "./commands/audits.js";
import { salesforceCommand } from "./commands/salesforce.js";

const program = new Command();

program
  .name("jetstackai")
  .description(
    "JetStack AI CLI - Manage CRM assets programmatically.\n\n" +
    "Authenticate with an Instance ID and Access Token from your\n" +
    "JetStack AI dashboard (Settings > API Keys), then use the\n" +
    "commands below to browse, import, and deploy CRM assets."
  )
  .version("0.4.0");

program.addHelpText(
  "after",
  `
Workflow:
  1. jetstackai auth login                       Authenticate with your Instance ID + Access Token
  2. jetstackai portals list                     List connected HubSpot portals
  3. jetstackai hubspot browse <portal> <type>   Browse assets in a portal (workflows, forms, etc.)
  4. jetstackai import start --portal ... --assets ... --name ...
                                                 Import selected assets into your library
  5. jetstackai import status <taskId> --watch   Watch import progress until complete
  6. jetstackai assets list --type workflows     List imported assets in your library
  7. jetstackai modules list                     List modules (asset collections)
  8. jetstackai mapping structure --source ... --target ... --assets ...
                                                 Get mapping requirements for deployment
  9. jetstackai mapping destinations --target ... --type properties --object-type contacts
                                                 Get available mapping targets in destination portal
 10. jetstackai deploy start --name ... --source ... --target ... --assets ... --mapping '{...}'
                                                 Deploy assets to target portal with mapping
 11. jetstackai deploy status <taskId> --watch   Watch deployment progress

Audit Workflow:
  1. jetstackai audits list-blocks --format table  List available audit blocks
  2. jetstackai audits list-templates               List existing templates
  3. jetstackai audits create-template --name "My Audit" --blocks DEAL_PIPELINE,EMAIL_MARKETING --report-type SIMPLE
                                                    Create a custom template
  4. jetstackai audits run --name "Q1 Audit" --template <id> --portal <id> --watch
                                                    Run audit and watch progress
  5. jetstackai audits data <auditRunId>            Fetch audit results

Supported asset types for browse:
  workflows, forms, emails, lists, pipelines, pages, templates,
  blogPosts, hubdbTables, properties, propertyGroups, customObjects

Examples:
  $ jetstackai hubspot browse abc123 workflows --format table
  $ jetstackai import start --portal abc123 --assets workflows:101,forms:202 --name "Q1 Import"
  $ jetstackai deploy start --name "Prod Deploy" --source abc --target def --assets workflows:fsId1 --mapping '{"assets":[],"properties":[],"pipelines":[],"owners":[]}'
`
);

// Register command groups
program.addCommand(authCommand);
program.addCommand(portalsCommand);
program.addCommand(hubspotCommand);
program.addCommand(importCommand);
program.addCommand(assetsCommand);
program.addCommand(modulesCommand);
program.addCommand(deployCommand);
program.addCommand(mappingCommand);
program.addCommand(tasksCommand);
program.addCommand(auditsCommand);
program.addCommand(salesforceCommand);

program.parse();
