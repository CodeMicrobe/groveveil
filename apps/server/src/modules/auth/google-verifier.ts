import { OAuth2Client } from "google-auth-library";

export interface GooglePayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export class GoogleAuthVerifier {
  private client: OAuth2Client;
  private clientId: string | undefined;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.client = new OAuth2Client(this.clientId);
  }

  public isConfigured(): boolean {
    return Boolean(
      this.clientId &&
        this.clientId !== "mock-or-real-google-client-id.apps.googleusercontent.com" &&
        !this.clientId.startsWith("placeholder")
    );
  }

  /**
   * Verifies a Google ID token cryptographically.
   * If credentials are not configured, explicitly returns an unconfigured status.
   * Never fakes authentication or issues fake success states.
   */
  public async verifyIdToken(idToken: string): Promise<GooglePayload> {
    if (!this.isConfigured()) {
      const error = new Error(
        "Google OAuth is not configured on this server. Real GOOGLE_CLIENT_ID is required."
      );
      (error as any).code = "AUTH_NOT_CONFIGURED";
      (error as any).statusCode = 503;
      throw error;
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        const error = new Error("Google ID token payload is missing required claims");
        (error as any).code = "INVALID_TOKEN_PAYLOAD";
        (error as any).statusCode = 401;
        throw error;
      }

      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (err: any) {
      if (err.code === "AUTH_NOT_CONFIGURED") throw err;

      const error = new Error(`Google token verification failed: ${err.message}`);
      (error as any).code = "INVALID_TOKEN";
      (error as any).statusCode = 401;
      throw error;
    }
  }
}

export const googleAuthVerifier = new GoogleAuthVerifier();
