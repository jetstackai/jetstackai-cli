#!/usr/bin/env node

import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import { portalsCommand } from "./commands/portals.js";
import {
  assetsCommand,
  modulesCommand,
  hubspotCommand,
  importCommand,
  deployCommand,
  mappingCommand,
  tasksCommand,
} from "./commands/stubs.js";

const program = new Command();

program
  .name("jetstackai")
  .description("JetStack AI CLI - HubSpot Asset Management")
  .version("0.1.0");

// Register command groups
program.addCommand(authCommand);
program.addCommand(portalsCommand);
program.addCommand(assetsCommand);
program.addCommand(modulesCommand);
program.addCommand(hubspotCommand);
program.addCommand(importCommand);
program.addCommand(deployCommand);
program.addCommand(mappingCommand);
program.addCommand(tasksCommand);

program.parse();
