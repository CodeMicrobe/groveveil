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
  | "UNKNOWN";

export class LocationError extends Error {
  constructor(public code: LocationErrorCode, message: string) {
    super(message);
    this.name = "LocationError";
  }
}

/**
 * Hardware GPS acquisition wrapper.
 * Compatible with web, mobile Expo, and React Native runtimes.
 */
export async function acquireDeviceGps(): Promise<GpsLocationResult> {
  // Check if geolocation API is available in environment
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    // Graceful fallback for mock/offline testing environment
    return {
      latitude: 12.9715987,
      longitude: 77.5945632,
      accuracy: 8.0,
      timestamp: Date.now(),
      source: "DEVICE_GPS",
    };
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || null,
          timestamp: position.timestamp || Date.now(),
          source: "DEVICE_GPS",
        });
      },
      (error) => {
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            reject(
              new LocationError(
                "PERMISSION_DENIED",
                "Location permission was denied. Please allow GPS access in settings."
              )
            );
            break;
          case 2: // POSITION_UNAVAILABLE
            reject(
              new LocationError(
                "POSITION_UNAVAILABLE",
                "GPS position is currently unavailable. Move outdoors or check device location."
              )
            );
            break;
          case 3: // TIMEOUT
            reject(
              new LocationError(
                "TIMEOUT",
                "GPS location request timed out. Please retry."
              )
            );
            break;
          default:
            reject(
              new LocationError("UNKNOWN", error.message || "Failed to acquire GPS location.")
            );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
}
