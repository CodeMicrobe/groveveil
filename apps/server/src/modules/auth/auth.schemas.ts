import { z } from "zod";

export const googleLoginSchema = z.object({
  idToken: z.string().min(10, "Google ID token is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, "Refresh token is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
