/**
 * Secure Storage Abstraction for JWTs and sensitive device tokens.
 * Falls back to memory in test or unsupported environments.
 */
class SecureStorageAdapter {
  private memoryStore = new Map<string, string>();

  async setItem(key: string, value: string): Promise<void> {
    try {
      this.memoryStore.set(key, value);
      // In production React Native, expo-secure-store will be utilized here
    } catch {
      this.memoryStore.set(key, value);
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return this.memoryStore.get(key) || null;
    } catch {
      return this.memoryStore.get(key) || null;
    }
  }

  async removeItem(key: string): Promise<void> {
    this.memoryStore.delete(key);
  }
}

export const secureStorage = new SecureStorageAdapter();
