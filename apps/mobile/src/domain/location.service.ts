import * as Location from "expo-location";

export interface GpsLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  source: "DEVICE_GPS";
}

export type LocationErrorCode =
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "NOT_SUPPORTED"
  | "SERVICES_DISABLED"
  | "UNKNOWN";

export class LocationError extends Error {
  constructor(public code: LocationErrorCode, message: string) {
    super(message);
    this.name = "LocationError";
    Object.setPrototypeOf(this, LocationError.prototype);
  }
}

export interface AcquireGpsOptions {
  timeoutMs?: number;
  accuracy?: Location.LocationAccuracy;
}

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Checks whether device-level location services are turned on.
 */
export async function isLocationServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

/**
 * Verifies or requests foreground location permissions.
 * Differentiates between granted, denied, and cannot request again.
 */
export async function ensureForegroundLocationPermission(): Promise<void> {
  let permissionResponse: Location.LocationPermissionResponse;

  try {
    permissionResponse = await Location.getForegroundPermissionsAsync();
  } catch (err: any) {
    throw new LocationError(
      "UNKNOWN",
      `Failed to check location permissions: ${err?.message || "Internal error"}`
    );
  }

  if (permissionResponse.status !== Location.PermissionStatus.GRANTED) {
    // If not granted, attempt request if permitted
    if (permissionResponse.canAskAgain) {
      try {
        permissionResponse = await Location.requestForegroundPermissionsAsync();
      } catch (err: any) {
        throw new LocationError(
          "UNKNOWN",
          `Failed to request location permission: ${err?.message || "Internal error"}`
        );
      }
    }

    if (permissionResponse.status !== Location.PermissionStatus.GRANTED) {
      if (!permissionResponse.canAskAgain) {
        throw new LocationError(
          "PERMISSION_DENIED",
          "Location permission was denied and cannot be requested automatically. Please enable location permissions for Groveveil in device settings."
        );
      }
      throw new LocationError(
        "PERMISSION_DENIED",
        "Location permission was denied. GPS access is required to verify tree planting location."
      );
    }
  }
}

/**
 * Hardware GPS acquisition wrapper for Groveveil tree planting proof.
 * Uses native Expo Location foreground APIs on demand.
 * Rejects cleanly on permission denial, disabled services, timeouts, or sensor failures.
 * Never returns fake or mock coordinates in production paths.
 */
export async function acquireDeviceGps(
  options?: AcquireGpsOptions
): Promise<GpsLocationResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const accuracy = options?.accuracy ?? Location.Accuracy.High;

  // 1. Check if device location services are enabled
  const servicesEnabled = await isLocationServicesEnabled();
  if (!servicesEnabled) {
    throw new LocationError(
      "SERVICES_DISABLED",
      "Device location services are disabled. Please turn on GPS in your device settings."
    );
  }

  // 2. Ensure foreground permissions are granted
  await ensureForegroundLocationPermission();

  // 3. Acquire current position with a timeout race to prevent indefinite hanging
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(
        new LocationError(
          "TIMEOUT",
          "GPS location request timed out. Please ensure you are outdoors with a clear view of the sky and retry."
        )
      );
    }, timeoutMs);
  });

  const positionPromise = (async () => {
    try {
      return await Location.getCurrentPositionAsync({
        accuracy,
        mayShowUserSettingsDialog: true,
      });
    } catch (err: any) {
      const message = err?.message || "";
      if (message.includes("Location services are disabled") || message.includes("provider")) {
        throw new LocationError(
          "SERVICES_DISABLED",
          "Device location services are disabled. Please turn on GPS in your device settings."
        );
      }
      if (message.includes("permission") || message.includes("denied")) {
        throw new LocationError(
          "PERMISSION_DENIED",
          "Location permission was denied. Please allow GPS access in settings."
        );
      }
      throw new LocationError(
        "POSITION_UNAVAILABLE",
        message
          ? `Failed to acquire GPS fix: ${message}`
          : "GPS position is currently unavailable. Move outdoors or check device sensors."
      );
    }
  })();

  try {
    const position = await Promise.race([positionPromise, timeoutPromise]);

    // 4. Validate coordinates
    if (
      !position ||
      !position.coords ||
      typeof position.coords.latitude !== "number" ||
      typeof position.coords.longitude !== "number" ||
      Number.isNaN(position.coords.latitude) ||
      Number.isNaN(position.coords.longitude)
    ) {
      throw new LocationError(
        "POSITION_UNAVAILABLE",
        "Received invalid or malformed GPS coordinates from device."
      );
    }

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
      timestamp: position.timestamp || Date.now(),
      source: "DEVICE_GPS",
    };
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}
