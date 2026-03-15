import { requireConfig, decodeInstanceId } from "./config.js";

interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const config = requireConfig();
  const baseUrl = decodeInstanceId(config.instanceId);
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
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
        if (errorBody.error) {
          errorMessage = errorBody.error;
        } else if (errorBody.message) {
          errorMessage = errorBody.message;
        }
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
  const baseUrl = decodeInstanceId(instanceId);
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
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
        error: json.error || json.message || response.statusText,
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
