import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { GoogleAuthService } from "../src/domain/auth/google-auth.service";

vi.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
    SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED",
  },
}));

describe("GoogleAuthService Native Flow & Error Handling", () => {
  let service: GoogleAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GoogleAuthService();
  });

  it("configures GoogleSignin with webClientId", async () => {
    vi.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
    vi.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: "success",
      data: {
        idToken: "mock-id-token-123",
        user: { id: "1", name: "Botanist", email: "botanist@groveveil.org", photo: null, familyName: null, givenName: null },
        scopes: [],
        serverAuthCode: null,
      },
    });

    const result = await service.signIn();
    expect(GoogleSignin.configure).toHaveBeenCalled();
    expect(result).toEqual({
      cancelled: false,
      idToken: "mock-id-token-123",
    });
  });

  it("handles user cancellation via response object without error", async () => {
    vi.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
    vi.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: "cancelled",
      data: null,
    });

    const result = await service.signIn();
    expect(result).toEqual({ cancelled: true });
  });

  it("handles user cancellation via thrown error code gracefully", async () => {
    vi.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
    const cancelErr: any = new Error("User cancelled");
    cancelErr.code = statusCodes.SIGN_IN_CANCELLED;
    vi.mocked(GoogleSignin.signIn).mockRejectedValue(cancelErr);

    const result = await service.signIn();
    expect(result).toEqual({ cancelled: true });
  });

  it("throws clear diagnostic message when Google Play Services is missing", async () => {
    vi.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
    const playErr: any = new Error("Play services not available");
    playErr.code = statusCodes.PLAY_SERVICES_NOT_AVAILABLE;
    vi.mocked(GoogleSignin.signIn).mockRejectedValue(playErr);

    await expect(service.signIn()).rejects.toThrowError(
      /Google Play Services is not available or outdated/
    );
  });

  it("throws actionable error if Google returns success but missing idToken", async () => {
    vi.mocked(GoogleSignin.hasPlayServices).mockResolvedValue(true);
    vi.mocked(GoogleSignin.signIn).mockResolvedValue({
      type: "success",
      data: {
        idToken: null,
        user: { id: "1", name: "Planter", email: "planter@groveveil.org", photo: null, familyName: null, givenName: null },
        scopes: [],
        serverAuthCode: null,
      },
    });

    await expect(service.signIn()).rejects.toThrowError(
      /no ID token was returned/
    );
  });

  it("invokes native signOut without crashing on error", async () => {
    vi.mocked(GoogleSignin.signOut).mockResolvedValue(null);
    await expect(service.signOut()).resolves.toBeUndefined();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });
});
