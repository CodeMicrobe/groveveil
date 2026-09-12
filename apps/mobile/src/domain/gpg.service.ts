import { apiClient } from "../data/api/api-client";
import { Platform } from "react-native";

export interface GpgLinkResponse {
  linked: boolean;
  displayName?: string;
  linkedAt?: string;
  reconciledCount: number;
}

export interface GpgStatusResponse {
  linked: boolean;
  displayName?: string;
  linkedAt?: string;
}

export const gpgMobileService = {
  isSupportedPlatform(): boolean {
    return Platform.OS === "android";
  },

  async getStatus(): Promise<GpgStatusResponse> {
    return apiClient.get<GpgStatusResponse>("/integrations/google-play-games/status");
  },

  async linkWithServerAuthCode(serverAuthCode: string): Promise<GpgLinkResponse> {
    return apiClient.post<GpgLinkResponse>("/integrations/google-play-games/link", {
      serverAuthCode,
    });
  },

  async unlink(): Promise<{ unlinked: boolean }> {
    return apiClient.delete<{ unlinked: boolean }>("/integrations/google-play-games/link");
  },
};
