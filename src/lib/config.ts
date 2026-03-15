import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface CliConfig {
  instanceId: string;
  accessToken: string;
  defaultFormat: "json" | "table";
}

export function getConfigPath(): string {
  return path.join(os.homedir(), ".jetstackai", "config.json");
}

export function loadConfig(): CliConfig | null {
  const configPath = getConfigPath();
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as CliConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: CliConfig): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function deleteConfig(): void {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch {
    // Ignore errors during deletion
  }
}

export function requireConfig(): CliConfig {
  const config = loadConfig();
  if (!config) {
    console.error(
      "\x1b[31mError: Not authenticated. Run `jetstackai auth login` first.\x1b[0m"
    );
    process.exit(1);
  }
  return config;
}

/**
 * Decode the Instance ID (base64) to get the actual server URL.
 */
export function decodeInstanceId(instanceId: string): string {
  return Buffer.from(instanceId, "base64").toString("utf-8");
}
