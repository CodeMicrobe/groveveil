import { create } from "zustand";
import {
  achievementMobileService,
  type NextMilestoneDTO,
  type AchievementItemDTO,
} from "../domain/achievement.service";

interface AchievementsState {
  currentVerifiedTreeCount: number;
  distinctSpeciesCount: number;
  nextMilestone: NextMilestoneDTO | null;
  achievements: AchievementItemDTO[];
  isLoading: boolean;
  error: string | null;

  fetchAchievements: () => Promise<void>;
  reset: () => void;
}

export const useAchievementsStore = create<AchievementsState>((set) => ({
  currentVerifiedTreeCount: 0,
  distinctSpeciesCount: 0,
  nextMilestone: null,
  achievements: [],
  isLoading: false,
  error: null,

  fetchAchievements: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await achievementMobileService.fetchAchievements();
      set({
        currentVerifiedTreeCount: data.currentVerifiedTreeCount,
        distinctSpeciesCount: data.distinctSpeciesCount,
        nextMilestone: data.nextMilestone,
        achievements: data.achievements,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || "Failed to load achievements",
      });
    }
  },

  reset: () => {
    set({
      currentVerifiedTreeCount: 0,
      distinctSpeciesCount: 0,
      nextMilestone: null,
      achievements: [],
      isLoading: false,
      error: null,
    });
  },
}));
