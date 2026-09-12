import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";

export interface GoogleSignInResult {
  cancelled: boolean;
  idToken?: string;
}

export class GoogleAuthService {
  private isConfigured = false;

  public configure(): void {
    if (this.isConfigured) return;

    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    console.log("[GoogleAuthService] Configuring with webClientId configured:", Boolean(webClientId));

    GoogleSignin.configure({
      webClientId: webClientId || undefined,
      offlineAccess: false,
      scopes: ["email", "profile"],
    });

    this.isConfigured = true;
  }

  /**
   * Prompts native Google Sign-In sheet on Android / iOS.
   * Resolves with { cancelled: true } if user dismisses the dialog.
   * Resolves with { cancelled: false, idToken: string } on success.
   * Throws friendly descriptive error on Play Services / network issues.
   */
  public async signIn(): Promise<GoogleSignInResult> {
    this.configure();

    try {
      console.log("[GoogleAuthService] Checking Play Services availability...");
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      console.log("[GoogleAuthService] Calling GoogleSignin.signIn()...");
      const response = await GoogleSignin.signIn();
      console.log("[GoogleAuthService] Received signIn response type:", response?.type);

      if (response && response.type === "cancelled") {
        return { cancelled: true };
      }

      if (response && response.type === "success") {
        const idToken = response.data?.idToken;
        if (!idToken) {
          throw new Error(
            "Google Sign-In completed, but no ID token was returned. Please verify your Google Web Client ID configuration."
          );
        }
        return { cancelled: false, idToken };
      }

      // Older/alternative SDK return shape fallback
      const data = (response as any)?.data || response;
      if (data?.idToken) {
        return { cancelled: false, idToken: data.idToken };
      }

      throw new Error("No ID token returned by Google.");
    } catch (err: any) {
      console.error("[GoogleAuthService] Caught error during signIn:", {
        code: err?.code,
        message: err?.message,
      });

      if (err?.code === statusCodes.SIGN_IN_CANCELLED || err?.message?.includes("cancelled")) {
        return { cancelled: true };
      }

      if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error(
          "Google Play Services is not available or outdated. Please update Google Play Services to continue."
        );
      }

      if (err?.code === statusCodes.IN_PROGRESS) {
        throw new Error("Sign-in is already in progress.");
      }

      throw new Error(err?.message || "Failed to sign in with Google.");
    }
  }

  /**
   * Clears Google Sign-In session from the device so account picker is shown next time.
   */
  public async signOut(): Promise<void> {
    try {
      this.configure();
      await GoogleSignin.signOut();
    } catch {
      // Ignored: failure to sign out of Google should not block Groveveil logout
    }
  }
}

export const googleAuthService = new GoogleAuthService();
