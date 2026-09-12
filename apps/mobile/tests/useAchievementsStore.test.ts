import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAchievementsStore } from "../src/application/useAchievementsStore";
import { achievementMobileService, UserAchievementsResponseDTO } from "../src/domain/achievement.service";

describe("useAchievementsStore", () => {
  beforeEach(() => {
    useAchievementsStore.getState().reset();
    vi.restoreAllMocks();
  });

  it("initializes with default empty state", () => {
    const state = useAchievementsStore.getState();
    expect(state.currentVerifiedTreeCount).toBe(0);
    expect(state.distinctSpeciesCount).toBe(0);
    expect(state.nextMilestone).toBeNull();
    expect(state.achievements).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("fetches achievements and updates store state correctly", async () => {
    const mockData: UserAchievementsResponseDTO = {
      currentVerifiedTreeCount: 12,
      distinctSpeciesCount: 4,
      nextMilestone: {
        id: "ach-2",
        key: "TREE_PLANTER_25",
        name: "Grove Tender",
        description: "Plant and verify 25 trees.",
        targetValue: 25,
        currentProgress: 12,
        remainingTrees: 13,
      },
      achievements: [
        {
          id: "ach-1",
          key: "FIRST_TREE",
          name: "First Seedling",
          description: "Plant and verify your very first tree.",
          category: "COUNT",
          criteriaType: "TOTAL_TREES",
          targetValue: 1,
          progress: 1,
          status: "UNLOCKED",
          unlockedAt: "2026-09-12T10:00:00Z",
          gpgSynced: true,
        },
        {
          id: "ach-2",
          key: "TREE_PLANTER_10",
          name: "Sapling Steward",
          description: "Plant and verify 10 trees.",
          category: "COUNT",
          criteriaType: "TOTAL_TREES",
          targetValue: 10,
          progress: 10,
          status: "UNLOCKED",
          unlockedAt: "2026-09-12T12:00:00Z",
          gpgSynced: true,
        },
        {
          id: "ach-3",
          key: "TREE_PLANTER_25",
          name: "Grove Tender",
          description: "Plant and verify 25 trees.",
          category: "COUNT",
          criteriaType: "TOTAL_TREES",
          targetValue: 25,
          progress: 12,
          status: "IN_PROGRESS",
          unlockedAt: null,
          gpgSynced: false,
        },
      ],
    };

    vi.spyOn(achievementMobileService, "fetchAchievements").mockResolvedValue(mockData);

    await useAchievementsStore.getState().fetchAchievements();

    const state = useAchievementsStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.currentVerifiedTreeCount).toBe(12);
    expect(state.distinctSpeciesCount).toBe(4);
    expect(state.nextMilestone?.key).toBe("TREE_PLANTER_25");
    expect(state.nextMilestone?.remainingTrees).toBe(13);
    expect(state.achievements).toHaveLength(3);
    expect(state.achievements[0].status).toBe("UNLOCKED");
    expect(state.achievements[2].status).toBe("IN_PROGRESS");
  });

  it("handles fetch failure by setting error state and clearing loading", async () => {
    vi.spyOn(achievementMobileService, "fetchAchievements").mockRejectedValue(
      new Error("Network connection lost")
    );

    await useAchievementsStore.getState().fetchAchievements();

    const state = useAchievementsStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe("Network connection lost");
    expect(state.achievements).toEqual([]);
  });

  it("resets store back to initial clean state", async () => {
    vi.spyOn(achievementMobileService, "fetchAchievements").mockResolvedValue({
      currentVerifiedTreeCount: 5,
      distinctSpeciesCount: 2,
      nextMilestone: null,
      achievements: [],
    });

    await useAchievementsStore.getState().fetchAchievements();
    expect(useAchievementsStore.getState().currentVerifiedTreeCount).toBe(5);

    useAchievementsStore.getState().reset();
    const state = useAchievementsStore.getState();
    expect(state.currentVerifiedTreeCount).toBe(0);
    expect(state.distinctSpeciesCount).toBe(0);
    expect(state.nextMilestone).toBeNull();
    expect(state.achievements).toEqual([]);
    expect(state.error).toBeNull();
  });
});
