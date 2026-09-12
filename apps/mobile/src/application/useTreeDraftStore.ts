import { create } from "zustand";
import { apiClient, ApiClientError } from "../data/api/api-client";
import { secureStorage } from "../data/storage/secure-storage";

export type PlantingContextType =
  | "BACKYARD"
  | "FARMLAND"
  | "PARK"
  | "ROADSIDE"
  | "FOREST"
  | "COMMUNITY_GARDEN"
  | "OTHER";

export interface PhotoProof {
  localUri: string;
  storageKey: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  capturedAt: string;
}

export interface TreeDraftState {
  // Wizard flow
  step: 1 | 2 | 3 | 4; // 1: Details, 2: Proof, 3: Review, 4: Success
  idempotencyKey: string;

  // Step 1: Details
  speciesId: string;
  speciesName: string;
  scientificName: string;
  plantedAt: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  locationSource: "DEVICE_GPS";
  locationName: string;
  context: PlantingContextType | null;
  notes: string;

  // Step 2: Proof
  photo: PhotoProof | null;
  isUploading: boolean;
  uploadError: string | null;

  // Step 3: Submission & Status
  isSubmitting: boolean;
  submitError: string | null;
  submittedTree: any | null;

  // Actions
  initNewDraft: () => void;
  setStep: (step: 1 | 2 | 3 | 4) => void;
  setSpecies: (id: string, commonName: string, scientificName: string) => void;
  setPlantedAt: (date: string) => void;
  setLocation: (lat: number, lng: number, accuracy: number | null) => void;
  setLocationName: (name: string) => void;
  setContext: (ctx: PlantingContextType | null) => void;
  setNotes: (notes: string) => void;
  setPhotoProof: (proof: PhotoProof | null) => void;
  setUploading: (uploading: boolean, error?: string | null) => void;
  submitReport: () => Promise<boolean>;
  resetDraft: () => void;
}

function generateUUID(): string {
  // RFC4122 v4 compliant UUID generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const STORAGE_DRAFT_KEY = "groveveil_tree_report_draft";

export const useTreeDraftStore = create<TreeDraftState>((set, get) => ({
  step: 1,
  idempotencyKey: generateUUID(),

  speciesId: "",
  speciesName: "",
  scientificName: "",
  plantedAt: new Date().toISOString().split("T")[0],
  latitude: null,
  longitude: null,
  locationAccuracy: null,
  locationSource: "DEVICE_GPS",
  locationName: "",
  context: null,
  notes: "",

  photo: null,
  isUploading: false,
  uploadError: null,

  isSubmitting: false,
  submitError: null,
  submittedTree: null,

  initNewDraft: () => {
    set({
      step: 1,
      idempotencyKey: generateUUID(),
      speciesId: "",
      speciesName: "",
      scientificName: "",
      plantedAt: new Date().toISOString().split("T")[0],
      latitude: null,
      longitude: null,
      locationAccuracy: null,
      locationSource: "DEVICE_GPS",
      locationName: "",
      context: null,
      notes: "",
      photo: null,
      isUploading: false,
      uploadError: null,
      isSubmitting: false,
      submitError: null,
      submittedTree: null,
    });
  },

  setStep: (step) => set({ step }),

  setSpecies: (speciesId, speciesName, scientificName) =>
    set({ speciesId, speciesName, scientificName }),

  setPlantedAt: (plantedAt) => set({ plantedAt }),

  setLocation: (latitude, longitude, locationAccuracy) =>
    set({ latitude, longitude, locationAccuracy }),

  setLocationName: (locationName) => set({ locationName }),

  setContext: (context) => set({ context }),

  setNotes: (notes) => set({ notes }),

  setPhotoProof: (photo) => set({ photo, uploadError: null }),

  setUploading: (isUploading, uploadError = null) =>
    set({ isUploading, uploadError }),

  submitReport: async () => {
    const state = get();

    // Verification of required fields
    if (!state.speciesId) {
      set({ submitError: "Please select a tree species." });
      return false;
    }
    if (state.latitude === null || state.longitude === null) {
      set({ submitError: "GPS location evidence is required." });
      return false;
    }
    if (!state.locationName.trim()) {
      set({ submitError: "Please enter a location name for display." });
      return false;
    }
    if (!state.photo || !state.photo.storageKey) {
      set({ submitError: "Step 2 Proof requires at least one uploaded photograph." });
      return false;
    }

    set({ isSubmitting: true, submitError: null });

    try {
      const payload = {
        idempotencyKey: state.idempotencyKey,
        speciesId: state.speciesId,
        plantedAt: new Date(state.plantedAt).toISOString(),
        latitude: state.latitude,
        longitude: state.longitude,
        locationAccuracy: state.locationAccuracy,
        locationSource: "DEVICE_GPS" as const,
        locationName: state.locationName.trim(),
        context: state.context || undefined,
        notes: state.notes.trim() || undefined,
        photos: [
          {
            storageKey: state.photo.storageKey,
            mediaType: state.photo.mediaType,
            capturedAt: state.photo.capturedAt,
          },
        ],
      };

      const response = await apiClient.post<{ tree: any; isReplay: boolean }>(
        "/trees",
        payload
      );

      set({
        isSubmitting: false,
        submittedTree: response.tree,
        step: 4, // Transition to success/pending screen
      });

      // Clear stored draft
      await secureStorage.removeItem(STORAGE_DRAFT_KEY);

      return true;
    } catch (err: any) {
      const errorMsg =
        err instanceof ApiClientError
          ? err.message
          : err.message || "Failed to submit tree report. Please check your network.";
      set({ isSubmitting: false, submitError: errorMsg });
      return false;
    }
  },

  resetDraft: () => {
    get().initNewDraft();
  },
}));
