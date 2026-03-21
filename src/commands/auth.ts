import { createCommand } from "commander";
import * as readline from "node:readline";
import {
  loadConfig,
  saveConfig,
  deleteConfig,
  requireConfig,
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
  error?: string;
} {
  try {
    const decoded = Buffer.from(instanceId, "base64").toString("utf-8");
    if (!decoded.startsWith("http")) {
      return {
        valid: false,
        error:
          "Instance ID does not appear valid. Please copy it from your JetStack AI dashboard.",
      };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      error:
        "Instance ID is not valid. Please copy it from your JetStack AI dashboard.",
    };
  }
}

/**
 * Mask an Instance ID for display: show first 8 and last 4 chars.
 */
function maskInstanceId(instanceId: string): string {
  if (instanceId.length <= 16) return instanceId.substring(0, 4) + "...";
  return instanceId.substring(0, 8) + "..." + instanceId.slice(-4);
}

export const authCommand = createCommand("auth").description(
  "Authentication commands (login, logout, status, whoami)"
);

authCommand
  .command("login")
  .description(
    "Authenticate with JetStack AI. Requires an Instance ID and Access Token from the Settings > API Keys page in your JetStack AI dashboard."
  )
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
  .description("Remove stored credentials and disconnect from JetStack AI")
  .action(() => {
    deleteConfig();
    printSuccess("Logged out successfully");
  });

authCommand
  .command("status")
  .description(
    "Check authentication and connection status by calling the /v1/health endpoint"
  )
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      printError("Not authenticated. Run `jetstackai auth login` first.");
      process.exit(1);
    }

    console.log(bold("Connection Status\n"));

    const tokenPrefix = config.accessToken.substring(0, 8) + "...";
    console.log(`  Access Token: ${dim(tokenPrefix)}`);
    console.log(`  Instance ID:  ${dim(maskInstanceId(config.instanceId))}`);
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
  .description("Show current authentication details (masked credentials)")
  .action(() => {
    const config = requireConfig();

    const tokenPrefix = config.accessToken.substring(0, 8) + "...";

    console.log(bold("Current Configuration\n"));
    console.log(`  Instance ID:    ${dim(maskInstanceId(config.instanceId))}`);
    console.log(`  Access Token:   ${dim(tokenPrefix)}`);
    console.log(`  Default Format: ${dim(config.defaultFormat)}`);
  });
