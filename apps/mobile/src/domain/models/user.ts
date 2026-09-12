export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  publicHandle: string;
  profileImageUrl?: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: string;
  stats?: {
    verifiedTreesCount: number;
    unlockedAchievementsCount: number;
  };
}

export interface PublicUserProfile {
  displayName: string;
  publicHandle: string;
  profileImageUrl?: string | null;
  memberSince: string;
  stats: {
    verifiedTreesCount: number;
    unlockedAchievementsCount: number;
  };
}
