import { describe, it, expect } from "vitest";
import { obfuscateCoordinates } from "../src/shared/utils/location.js";

describe("Location Privacy Obfuscation Utility", () => {
  it("obfuscates high precision GPS coordinates into grid-rounded values", () => {
    // Exact private residential coordinate
    const exactLat = 12.9715987654;
    const exactLng = 77.5945632145;

    const obfuscated = obfuscateCoordinates(exactLat, exactLng);

    // Should not equal exact coordinates
    expect(obfuscated.latitude).not.toBe(exactLat);
    expect(obfuscated.longitude).not.toBe(exactLng);

    // Precision should be reduced to 4 decimal places
    const latDecimals = obfuscated.latitude.toString().split(".")[1]?.length || 0;
    const lngDecimals = obfuscated.longitude.toString().split(".")[1]?.length || 0;

    expect(latDecimals).toBeLessThanOrEqual(4);
    expect(lngDecimals).toBeLessThanOrEqual(4);

    // Distance offset should remain within ~200m
    const latDiff = Math.abs(obfuscated.latitude - exactLat);
    const lngDiff = Math.abs(obfuscated.longitude - exactLng);

    expect(latDiff).toBeLessThan(0.003);
    expect(lngDiff).toBeLessThan(0.003);
  });
});
