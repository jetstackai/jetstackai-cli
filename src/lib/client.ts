import {
  requireConfig,
  isLegacyInstanceId,
  decodeLegacyInstanceId,
  API_GATEWAY_URL,
} from "./config.js";

interface ApiResponse<T> {
  data: T;
  error?: { code: string; message: string } | string;
  // RFC 7807 fields
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
  message?: string;
}

function extractError(body: ApiResponse<unknown>): string {
  // RFC 7807 format
  if (body.detail) return body.detail;
  // Legacy format
  if (body.error) {
    if (typeof body.error === "object" && body.error.message) {
      return body.error.message;
    }
    if (typeof body.error === "string") {
      return body.error;
    }
  }
  if (body.message) return body.message;
  return "Unknown error";
}

/**
 * Resolve the base URL and headers for an Instance ID.
 * - New short IDs (e.g. "leanstack"): route through api.jetstack.ai with X-Instance-Id header
 * - Legacy base64 IDs: decode to direct URL (backward compat)
 */
function resolveInstance(instanceId: string): {
  baseUrl: string;
  extraHeaders: Record<string, string>;
} {
  if (isLegacyInstanceId(instanceId)) {
    // Legacy: base64 → direct URL, no gateway
    return {
      baseUrl: decodeLegacyInstanceId(instanceId).replace(/\/$/, ""),
      extraHeaders: {},
    };
  }
  // New: route through API gateway
  return {
    baseUrl: API_GATEWAY_URL,
    extraHeaders: { "X-Instance-Id": instanceId },
  };
}

export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const config = requireConfig();
  const { baseUrl, extraHeaders } = resolveInstance(config.instanceId);
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = (await response.json()) as ApiResponse<unknown>;
        errorMessage = extractError(errorBody);
      } catch {
        // Use default error message
      }
      console.error(`\x1b[31mError: ${errorMessage}\x1b[0m`);
      process.exit(1);
    }

    const json = (await response.json()) as ApiResponse<T>;
    return json.data;
  } catch (error) {
    if (error instanceof Error && error.message.includes("fetch")) {
      console.error(
        `\x1b[31mConnection error: Unable to reach the server.\x1b[0m`
      );
      console.error(
        `\x1b[2mCheck your network connection and Instance ID configuration.\x1b[0m`
      );
    } else if (error instanceof Error && error.name !== "ExitPromptError") {
      console.error(`\x1b[31mError: ${error.message}\x1b[0m`);
    }
    process.exit(1);
  }
}

export async function apiRequestRaw<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  instanceId: string,
  accessToken: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const { baseUrl, extraHeaders } = resolveInstance(instanceId);
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const json = (await response.json()) as ApiResponse<T>;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: extractError(json),
      };
    }

    return { ok: true, status: response.status, data: json.data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error:
        error instanceof Error ? error.message : "Unknown connection error",
    };
  }
}
