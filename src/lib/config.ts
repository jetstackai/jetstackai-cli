import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * API Gateway URL — all requests route through here.
 * The gateway maps Instance IDs to tenant backends.
 */
export const API_GATEWAY_URL = "https://api.jetstack.ai";

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
 * Check if an Instance ID is a legacy base64-encoded URL.
 */
export function isLegacyInstanceId(instanceId: string): boolean {
  if (instanceId.length < 20) return false;
  try {
    const decoded = Buffer.from(instanceId, "base64").toString("utf-8");
    return decoded.startsWith("http://") || decoded.startsWith("https://");
  } catch {
    return false;
  }
}

/**
 * Decode a legacy base64 Instance ID to get the backend URL.
 */
export function decodeLegacyInstanceId(instanceId: string): string {
  return Buffer.from(instanceId, "base64").toString("utf-8");
}
