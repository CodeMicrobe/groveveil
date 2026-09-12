/**
 * Obfuscates coordinates for public consumption.
 * Adds randomized deterministic jitter or grid snapping (~150m)
 * so that private property or sensitive personal coordinates are never exposed publicly.
 */
export function obfuscateCoordinates(
  latitude: number,
  longitude: number,
  jitterMeters: number = 150
): { latitude: number; longitude: number } {
  // Earth's radius in meters
  const earthRadius = 6378137;
  
  // Deterministic seed / grid rounding to ~0.0015 degrees (~150m at equator)
  const precision = 0.002;
  const latRounded = Math.round(latitude / precision) * precision;
  const lngRounded = Math.round(longitude / precision) * precision;

  return {
    latitude: Number(latRounded.toFixed(4)),
    longitude: Number(lngRounded.toFixed(4)),
  };
}
