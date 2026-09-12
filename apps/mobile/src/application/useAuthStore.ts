import { create } from "zustand";
import type { UserProfile } from "../domain/models/user";
import { secureStorage } from "../data/storage/secure-storage";
import { apiClient } from "../data/api/api-client";
import { googleAuthService } from "../domain/auth/google-auth.service";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  error: string | null;

  initialize: () => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,

  initialize: async () => {
    try {
      const token = await secureStorage.getItem("auth_token");
      if (token) {
        set({ isAuthenticated: true, isLoading: true });
        await get().fetchCurrentUser();
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  loginWithGoogleIdToken: async (idToken: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post<{
        token: string;
        refreshToken: string;
        user: UserProfile;
      }>("/auth/google", { idToken });

      await secureStorage.setItem("auth_token", res.token);
      await secureStorage.setItem("refresh_token", res.refreshToken);

      set({
        isAuthenticated: true,
        isLoading: false,
        user: res.user,
        error: null,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || "Login failed",
      });
      throw err;
    }
  },

  fetchCurrentUser: async () => {
    try {
      const user = await apiClient.get<UserProfile>("/me");
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (err: any) {
      // If unauthorized, wipe token
      if (err.statusCode === 401) {
        await secureStorage.removeItem("auth_token");
        set({ isAuthenticated: false, user: null, isLoading: false });
      } else {
        set({ isLoading: false, error: err.message });
      }
    }
  },

  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore network errors on logout
    }
    await googleAuthService.signOut();
    await secureStorage.removeItem("auth_token");
    await secureStorage.removeItem("refresh_token");
    set({ isAuthenticated: false, user: null, error: null });
  },

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
}));
