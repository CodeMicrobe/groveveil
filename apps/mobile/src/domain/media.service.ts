import { apiClient } from "../data/api/api-client";

export interface UploadIntentResponse {
  intentId: string;
  mediaId: string;
  storageKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  maxBytes: number;
  expiresAt: string;
}

export interface UploadedProofResult {
  storageKey: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  capturedAt: string;
}

export class MediaService {
  /**
   * Coordinates the 2-stage server-authorized upload:
   * 1. Acquire upload intent with server-bound storageKey
   * 2. Perform direct binary PUT upload
   */
  async uploadPhotoProof(
    binaryData: any,
    contentType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
    contentLength: number = 1024 * 50
  ): Promise<UploadedProofResult> {
    // 1. Request upload intent
    const intent = await apiClient.post<UploadIntentResponse>(
      "/media/upload-intent",
      {
        contentType,
        contentLength,
      }
    );

    // 2. Direct binary upload via PUT
    await apiClient.uploadBinary(
      intent.uploadUrl,
      binaryData,
      contentType
    );

    return {
      storageKey: intent.storageKey,
      mediaType: contentType,
      capturedAt: new Date().toISOString(),
    };
  }
}

export const mediaService = new MediaService();
