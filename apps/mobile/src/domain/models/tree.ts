export type TreeStatus = "SUBMITTED" | "ARCHIVED" | "REMOVED";
export type VerificationStatus = "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";

export interface TreeReportInput {
  speciesId: string;
  plantedAt: string;
  latitude: number;
  longitude: number;
  locationName: string;
  locationAccuracy?: number;
  locationSource?: "device_gps" | "manual";
  notes?: string;
  context?: string;
  photoKeys: string[];
  idempotencyKey: string;
}

export interface TreeRecord {
  id: string;
  speciesId: string;
  speciesCommonName: string;
  speciesScientificName: string;
  plantedAt: string;
  latitude: number;
  longitude: number;
  locationName: string;
  status: TreeStatus;
  verificationStatus: VerificationStatus;
  photoUrls: string[];
  createdAt: string;
}
