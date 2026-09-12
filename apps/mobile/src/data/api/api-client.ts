import { secureStorage } from "../storage/secure-storage";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
  };
}

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function resolveDefaultBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 1. In React Native Development Builds, the Metro packager host IP is available via SourceCode.scriptURL
  try {
    const { NativeModules } = require("react-native");
    const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      const host = match ? match[1] : null;
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        return `http://${host}:3000/api/v1`;
      }
    }
  } catch {
    // Safe fallback for non-native environments
  }

  // 2. In Expo Go, dynamically target the Metro bundler host IP
  try {
    const Constants = require("expo-constants").default || require("expo-constants");
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest2?.extra?.expoClient?.hostUri ||
      Constants.linkingUri;
    if (hostUri) {
      const match = hostUri.match(/^https?:\/\/([^:/]+)/) || hostUri.split(":")[0];
      const host = typeof match === "string" ? match : match?.[1];
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        return `http://${host}:3000/api/v1`;
      }
    }
  } catch {
    // Safe fallback for Node/unit test environments
  }

  return "http://localhost:3000/api/v1";
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || resolveDefaultBaseUrl();
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    const token = await secureStorage.getItem("auth_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const authHeaders = await this.getAuthHeader();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders,
      ...(options.headers as Record<string, string>),
    };

    try {
      console.log(`[ApiClient] Sending ${options.method || "GET"} to ${url}`);
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const json: ApiResponse<T> = await response.json();

      if (!response.ok || !json.success) {
        throw new ApiClientError(
          json.error?.code || "API_ERROR",
          json.error?.message || `Request failed with status ${response.status}`,
          response.status,
          json.error?.details
        );
      }

      return json.data as T;
    } catch (err: any) {
      console.error(`[ApiClient] Request to ${url} failed:`, err?.message || err);
      if (err instanceof ApiClientError) {
        throw err;
      }
      throw new ApiClientError(
        "NETWORK_ERROR",
        err.message || "Network request failed",
        0
      );
    }
  }

  get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", headers });
  }

  post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  patch<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE", headers });
  }

  async uploadBinary(
    endpointOrUrl: string,
    binaryBody: any,
    contentType: string
  ): Promise<any> {
    const isAbsolute =
      endpointOrUrl.startsWith("http://") || endpointOrUrl.startsWith("https://");
    const url = isAbsolute
      ? endpointOrUrl
      : `${this.baseUrl}${endpointOrUrl.startsWith("/") ? "" : "/"}${endpointOrUrl}`;
    const authHeaders = await this.getAuthHeader();

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        ...authHeaders,
      },
      body: binaryBody,
    });

    if (!response.ok) {
      let errorMsg = `Upload failed with status ${response.status}`;
      try {
        const json = await response.json();
        errorMsg = json.error?.message || errorMsg;
      } catch {
        // Ignored
      }
      throw new ApiClientError("UPLOAD_FAILED", errorMsg, response.status);
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}

export const apiClient = new ApiClient();
