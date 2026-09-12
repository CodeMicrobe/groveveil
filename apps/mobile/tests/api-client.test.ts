import { describe, it, expect, vi } from "vitest";
import { ApiClient, ApiClientError } from "../src/data/api/api-client";
import { secureStorage } from "../src/data/storage/secure-storage";

describe("Mobile API Client & Storage Abstraction", () => {
  it("injects Bearer authorization token when available in secure storage", async () => {
    await secureStorage.setItem("auth_token", "test-auth-jwt-token-12345");

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { message: "Authenticated successfully" },
      }),
    });
    global.fetch = mockFetch;

    const client = new ApiClient("http://test.local/api/v1");
    const result = await client.get<{ message: string }>("/test");

    expect(result.message).toBe("Authenticated successfully");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test.local/api/v1/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-auth-jwt-token-12345",
        }),
      })
    );

    await secureStorage.removeItem("auth_token");
  });

  it("throws ApiClientError with code and status when server returns error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Access forbidden",
        },
      }),
    });
    global.fetch = mockFetch;

    const client = new ApiClient("http://test.local/api/v1");
    await expect(client.get("/forbidden")).rejects.toThrowError(ApiClientError);
  });
});
