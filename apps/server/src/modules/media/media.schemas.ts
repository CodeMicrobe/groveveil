import { z } from "zod";

export const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

export const MAX_MEDIA_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const createUploadIntentSchema = z.object({
  contentType: z.enum(ALLOWED_MEDIA_TYPES, {
    errorMap: () => ({ message: "Only image/jpeg, image/png, and image/webp are supported" }),
  }),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(MAX_MEDIA_SIZE_BYTES, {
      message: `File size must not exceed ${MAX_MEDIA_SIZE_BYTES / (1024 * 1024)}MB`,
    }),
});

export type CreateUploadIntentDTO = z.infer<typeof createUploadIntentSchema>;
