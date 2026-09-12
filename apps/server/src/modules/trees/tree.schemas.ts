import { z } from "zod";

export const PLANTING_CONTEXTS = [
  "BACKYARD",
  "FARMLAND",
  "PARK",
  "ROADSIDE",
  "FOREST",
  "COMMUNITY_GARDEN",
  "OTHER",
] as const;

export const submitTreeSchema = z.object({
  idempotencyKey: z.string().uuid({ message: "idempotencyKey must be a valid UUID" }),
  speciesId: z.string().uuid({ message: "speciesId must be a valid UUID" }),
  plantedAt: z
    .string()
    .datetime({ message: "plantedAt must be an ISO 8601 timestamp" })
    .refine(
      (val) => new Date(val).getTime() <= Date.now() + 5 * 60 * 1000,
      { message: "Planting date cannot be in the future" }
    ),
  latitude: z
    .number({ required_error: "latitude is required" })
    .min(-90, "Latitude must be >= -90")
    .max(90, "Latitude must be <= 90"),
  longitude: z
    .number({ required_error: "longitude is required" })
    .min(-180, "Longitude must be >= -180")
    .max(180, "Longitude must be <= 180"),
  locationAccuracy: z.number().positive().optional().nullable(),
  locationSource: z.literal("DEVICE_GPS", {
    errorMap: () => ({ message: "locationSource must strictly be DEVICE_GPS for authoritative proof" }),
  }),
  locationName: z
    .string({ required_error: "locationName is required for display" })
    .min(1, "Location name is required")
    .max(120, "Location name must not exceed 120 characters")
    .trim(),
  context: z.enum(PLANTING_CONTEXTS).optional().nullable(),
  notes: z.string().max(1000, "Notes must not exceed 1000 characters").trim().optional().nullable(),
  photos: z
    .array(
      z.object({
        storageKey: z
          .string()
          .regex(/^trees\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/, {
            message: "storageKey must follow the canonical pattern trees/{userId}/{mediaId}.{ext}",
          }),
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        capturedAt: z.string().datetime().optional().nullable(),
      })
    )
    .min(1, "Step 2 Proof requires at least one photograph")
    .max(5, "Maximum of 5 photos allowed per tree report"),
});

export type SubmitTreeDTO = z.infer<typeof submitTreeSchema>;
