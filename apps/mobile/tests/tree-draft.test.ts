import { describe, it, expect, beforeEach } from "vitest";
import { useTreeDraftStore } from "../src/application/useTreeDraftStore";

describe("Mobile Tree Draft & Wizard State Store", () => {
  beforeEach(() => {
    useTreeDraftStore.getState().initNewDraft();
  });

  it("initializes with step 1 and a valid client-generated UUID idempotencyKey", () => {
    const state = useTreeDraftStore.getState();
    expect(state.step).toBe(1);
    expect(state.idempotencyKey).toBeDefined();
    expect(state.idempotencyKey.length).toBe(36); // UUID length
    expect(state.locationSource).toBe("DEVICE_GPS");
    expect(state.photo).toBeNull();
  });

  it("updates wizard fields and transitions steps correctly", () => {
    const store = useTreeDraftStore.getState();

    store.setSpecies("species-123", "Neem", "Azadirachta indica");
    store.setLocation(12.9716, 77.5946, 5.0);
    store.setLocationName("Indiranagar Park");
    store.setContext("PARK");
    store.setNotes("Planted with organic compost");

    const updated = useTreeDraftStore.getState();
    expect(updated.speciesId).toBe("species-123");
    expect(updated.speciesName).toBe("Neem");
    expect(updated.latitude).toBe(12.9716);
    expect(updated.longitude).toBe(77.5946);
    expect(updated.locationAccuracy).toBe(5.0);
    expect(updated.locationName).toBe("Indiranagar Park");
    expect(updated.context).toBe("PARK");
    expect(updated.notes).toBe("Planted with organic compost");

    // Transition to step 2 (Proof)
    store.setStep(2);
    expect(useTreeDraftStore.getState().step).toBe(2);
  });

  it("attaches photographic proof and clears upload error", () => {
    const store = useTreeDraftStore.getState();

    store.setPhotoProof({
      localUri: "file:///local/photo.jpg",
      storageKey: "trees/usr_1/med_1.jpg",
      mediaType: "image/jpeg",
      capturedAt: new Date().toISOString(),
    });

    const state = useTreeDraftStore.getState();
    expect(state.photo).toBeDefined();
    expect(state.photo?.storageKey).toBe("trees/usr_1/med_1.jpg");
    expect(state.uploadError).toBeNull();
  });

  it("blocks submission when required proof or fields are missing", async () => {
    const store = useTreeDraftStore.getState();

    // Missing everything initially
    const success1 = await store.submitReport();
    expect(success1).toBe(false);
    expect(useTreeDraftStore.getState().submitError).toContain("species");

    // Set species but miss GPS
    store.setSpecies("species-123", "Neem", "Azadirachta indica");
    const success2 = await store.submitReport();
    expect(success2).toBe(false);
    expect(useTreeDraftStore.getState().submitError).toContain("GPS");

    // Set GPS but miss photo proof
    store.setLocation(12.9716, 77.5946, 5.0);
    store.setLocationName("Test Location");
    const success3 = await store.submitReport();
    expect(success3).toBe(false);
    expect(useTreeDraftStore.getState().submitError).toContain("photograph");
  });

  it("resets draft and generates a new idempotencyKey for subsequent tree reports", () => {
    const store = useTreeDraftStore.getState();
    const initialKey = store.idempotencyKey;

    store.setSpecies("species-1", "Mango", "Mangifera indica");
    store.resetDraft();

    const resetState = useTreeDraftStore.getState();
    expect(resetState.speciesId).toBe("");
    expect(resetState.step).toBe(1);
    expect(resetState.idempotencyKey).not.toBe(initialKey);
  });
});
