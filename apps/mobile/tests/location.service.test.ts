import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Location from "expo-location";
import {
  acquireDeviceGps,
  isLocationServicesEnabled,
  ensureForegroundLocationPermission,
  LocationError,
} from "../src/domain/location.service";

vi.mock("expo-location", () => ({
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
  PermissionStatus: {
    GRANTED: "granted",
    UNDETERMINED: "undetermined",
    DENIED: "denied",
  },
  hasServicesEnabledAsync: vi.fn(),
  getForegroundPermissionsAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));

describe("Native Location Service (expo-location)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Permission Granted Flow", () => {
    it("returns normalized GPS location and preserves accuracy when permission is already granted", async () => {
      vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
      vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: "never",
      });
      vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          altitude: 15.2,
          accuracy: 4.8,
          altitudeAccuracy: 1.0,
          heading: 0,
          speed: 0,
        },
        timestamp: 1690000000000,
      });

      const result = await acquireDeviceGps();

      expect(result).toEqual({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 4.8,
        timestamp: 1690000000000,
        source: "DEVICE_GPS",
      });
      expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
      });
      expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it("requests foreground permission when undetermined and succeeds if user grants it", async () => {
      vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
      vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.UNDETERMINED,
        granted: false,
        canAskAgain: true,
        expires: "never",
      });
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: "never",
      });
      vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
        coords: {
          latitude: 51.5074,
          longitude: -0.1278,
          altitude: null,
          accuracy: 12.0,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: 1690000001000,
      });

      const result = await acquireDeviceGps();

      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(result.latitude).toBe(51.5074);
      expect(result.longitude).toBe(-0.1278);
      expect(result.accuracy).toBe(12.0);
      expect(result.source).toBe("DEVICE_GPS");
    });
  });

  describe("Permission Denied Flow", () => {
    it("throws LocationError with PERMISSION_DENIED when permission is denied and can ask again", async () => {
      vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
      vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.DENIED,
        granted: false,
        canAskAgain: true,
        expires: "never",
      });
      vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.DENIED,
        granted: false,
        canAskAgain: true,
        expires: "never",
      });

      await expect(acquireDeviceGps()).rejects.toThrow(LocationError);

      try {
        await acquireDeviceGps();
      } catch (err: any) {
        expect(err).toBeInstanceOf(LocationError);
        expect(err.code).toBe("PERMISSION_DENIED");
        expect(err.message).toContain("Location permission was denied");
      }

      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it("throws LocationError with settings guidance when permission is permanently denied (cannot ask again)", async () => {
      vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
      vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.DENIED,
        granted: false,
        canAskAgain: false,
        expires: "never",
      });

      try {
        await acquireDeviceGps();
        expect.unreachable("Should have thrown LocationError");
      } catch (err: any) {
        expect(err).toBeInstanceOf(LocationError);
        expect(err.code).toBe("PERMISSION_DENIED");
        expect(err.message).toContain("device settings");
      }

      // Should not prompt user again if canAskAgain is false
      expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe("Location Services Disabled", () => {
    it("throws LocationError with SERVICES_DISABLED when device location services are off", async () => {
      vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);

      try {
        await acquireDeviceGps();
        expect.unreachable("Should have thrown LocationError");
      } catch (err: any) {
        expect(err).toBeInstanceOf(LocationError);
        expect(err.code).toBe("SERVICES_DISABLED");
        expect(err.message).toContain("Device location services are disabled");
      }

      expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });
  });

  describe("Position Failures and Mock Removal Verification", () => {
    it("throws LocationError with POSITION_UNAVAILABLE when native position fix fails and never returns fake coordinates", async () => {
      vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
      vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: "never",
      });
      vi.mocked(Location.getCurrentPositionAsync).mockRejectedValue(
        new Error("GPS engine failed to acquire fix")
      );

      try {
        await acquireDeviceGps();
        expect.unreachable("Should have thrown LocationError");
      } catch (err: any) {
        expect(err).toBeInstanceOf(LocationError);
        expect(err.code).toBe("POSITION_UNAVAILABLE");
        expect(err.message).toContain("GPS engine failed to acquire fix");
      }
    });

    it("throws LocationError with TIMEOUT when position acquisition exceeds timeout", async () => {
      vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
      vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: "never",
      });
      // Return a promise that does not resolve within the timeout
      vi.mocked(Location.getCurrentPositionAsync).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 500))
      );

      try {
        // Use custom short timeoutMs for test
        await acquireDeviceGps({ timeoutMs: 50 });
        expect.unreachable("Should have thrown TIMEOUT LocationError");
      } catch (err: any) {
        expect(err).toBeInstanceOf(LocationError);
        expect(err.code).toBe("TIMEOUT");
        expect(err.message).toContain("timed out");
      }
    });

    it("rejects malformed coordinates without substituting coordinates", async () => {
      vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
      vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: "never",
      });
      vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
        coords: {
          latitude: NaN,
          longitude: NaN,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });

      try {
        await acquireDeviceGps();
        expect.unreachable("Should have rejected NaN coordinates");
      } catch (err: any) {
        expect(err).toBeInstanceOf(LocationError);
        expect(err.code).toBe("POSITION_UNAVAILABLE");
        expect(err.message).toContain("invalid or malformed");
      }
    });
  });

  describe("Helper Functions", () => {
    it("isLocationServicesEnabled returns boolean safely even on exception", async () => {
      vi.mocked(Location.hasServicesEnabledAsync).mockRejectedValue(new Error("Native bridge error"));
      const result = await isLocationServicesEnabled();
      expect(result).toBe(false);
    });

    it("ensureForegroundLocationPermission passes smoothly if granted", async () => {
      vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
        status: Location.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: "never",
      });

      await expect(ensureForegroundLocationPermission()).resolves.toBeUndefined();
    });
  });
});
