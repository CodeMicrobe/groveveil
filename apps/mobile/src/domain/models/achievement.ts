export type AchievementCategory = "MILESTONE" | "IMPACT" | "SPECIAL";
export type AchievementStatus = "LOCKED" | "IN_PROGRESS" | "UNLOCKED";

export interface AchievementItem {
  id: string;
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  criteriaType: string;
  targetValue: number;
  iconUrl: string;
  status: AchievementStatus;
  progress: number;
  unlockedAt?: string | null;
}
