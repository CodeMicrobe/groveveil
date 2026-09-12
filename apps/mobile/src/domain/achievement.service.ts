import { apiClient } from "../data/api/api-client";

export interface NextMilestoneDTO {
  id: string;
  key: string;
  name: string;
  description: string;
  targetValue: number;
  currentProgress: number;
  remainingTrees: number;
}

export interface AchievementItemDTO {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  criteriaType: string;
  targetValue: number;
  progress: number;
  status: "LOCKED" | "IN_PROGRESS" | "UNLOCKED";
  unlockedAt: string | null;
  gpgSynced: boolean;
}

export interface UserAchievementsResponseDTO {
  currentVerifiedTreeCount: number;
  distinctSpeciesCount: number;
  nextMilestone: NextMilestoneDTO | null;
  achievements: AchievementItemDTO[];
}

export const achievementMobileService = {
  async fetchAchievements(): Promise<UserAchievementsResponseDTO> {
    return apiClient.get<UserAchievementsResponseDTO>("/achievements");
  },
};
