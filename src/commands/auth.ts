import { createCommand } from "commander";
import * as readline from "node:readline";
import {
  loadConfig,
  saveConfig,
  deleteConfig,
  requireConfig,
  decodeInstanceId,
  type CliConfig,
} from "../lib/config.js";
import { apiRequestRaw } from "../lib/client.js";
import {
  printSuccess,
  printError,
  bold,
  dim,
  green,
  red,
} from "../lib/output.js";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

interface HealthResponse {
  status: string;
  orgId?: string;
  scopes?: string[];
  message?: string;
}

/**
 * Validate that an Instance ID is valid base64 that decodes to a URL starting with http.
 */
function validateInstanceId(instanceId: string): {
  valid: boolean;
  decoded?: string;
  error?: string;
} {
  try {
    const decoded = Buffer.from(instanceId, "base64").toString("utf-8");
    if (!decoded.startsWith("http")) {
      return {
        valid: false,
        error:
          "Instance ID does not decode to a valid URL. Please copy it from your JetStack AI dashboard.",
      };
    }
    return { valid: true, decoded };
  } catch {
    return {
      valid: false,
      error:
        "Instance ID is not valid. Please copy it from your JetStack AI dashboard.",
    };
  }
}

export const authCommand = createCommand("auth").description(
  "Authentication commands"
);

authCommand
  .command("login")
  .description("Authenticate with JetStack AI")
  .action(async () => {
    console.log(bold("JetStack AI - Authentication\n"));

    const instanceId = await prompt("Enter your Instance ID: ");
    if (!instanceId) {
      printError("Instance ID is required.");
      process.exit(1);
    }

    const validation = validateInstanceId(instanceId);
    if (!validation.valid) {
      printError(validation.error!);
      process.exit(1);
    }

    const accessToken = await prompt("Enter your Access Token: ");
    if (!accessToken) {
      printError("Access Token is required.");
      process.exit(1);
    }

    if (!accessToken.startsWith("jsai_")) {
      printError(
        'Invalid Access Token format. Token should start with "jsai_".'
      );
      process.exit(1);
    }

    console.log(dim("\nValidating credentials..."));

    const result = await apiRequestRaw<HealthResponse>(
      "GET",
      instanceId,
      accessToken,
      "/v1/health"
    );

    if (!result.ok) {
      printError(`Authentication failed: ${result.error}`);
      process.exit(1);
    }

    const config: CliConfig = {
      instanceId,
      accessToken,
      defaultFormat: "json",
    };

    saveConfig(config);
    console.log("");
    printSuccess("Connected successfully");

    if (result.data) {
      if (result.data.orgId) {
        console.log(`  Organization: ${bold(result.data.orgId)}`);
      }
      if (result.data.scopes) {
        console.log(`  Scopes: ${result.data.scopes.join(", ")}`);
      }
    }
  });

authCommand
  .command("logout")
  .description("Remove stored credentials")
  .action(() => {
    deleteConfig();
    printSuccess("Logged out successfully");
  });

authCommand
  .command("status")
  .description("Check authentication and connection status")
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      printError("Not authenticated. Run `jetstackai auth login` first.");
      process.exit(1);
    }

    console.log(bold("Connection Status\n"));

    const tokenPrefix = config.accessToken.substring(0, 8) + "...";
    const decodedUrl = decodeInstanceId(config.instanceId);
    console.log(`  Access Token: ${dim(tokenPrefix)}`);
    console.log(`  Instance:     ${dim(decodedUrl)}`);
    console.log("");

    const result = await apiRequestRaw<HealthResponse>(
      "GET",
      config.instanceId,
      config.accessToken,
      "/v1/health"
    );

    if (result.ok) {
      console.log(`  Status: ${green("Connected")}`);
      if (result.data) {
        if (result.data.orgId) {
          console.log(`  Org ID: ${result.data.orgId}`);
        }
        if (result.data.scopes) {
          console.log(`  Scopes: ${result.data.scopes.join(", ")}`);
        }
      }
    } else {
      console.log(`  Status: ${red("Disconnected")}`);
      console.log(`  Error:  ${result.error}`);
    }
  });

authCommand
  .command("whoami")
  .description("Show current authentication details")
  .action(() => {
    const config = requireConfig();

    const tokenPrefix = config.accessToken.substring(0, 8) + "...";
    const decodedUrl = decodeInstanceId(config.instanceId);

    console.log(bold("Current Configuration\n"));
    console.log(`  Access Token:   ${dim(tokenPrefix)}`);
    console.log(`  Instance:       ${dim(decodedUrl)}`);
    console.log(`  Default Format: ${dim(config.defaultFormat)}`);
  });
