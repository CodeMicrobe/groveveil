import { describe, it, expect } from "vitest";
import { getCanonicalFriendshipPair } from "../src/shared/utils/canonical-friend.js";

describe("Canonical Friendship Ordering Utility", () => {
  it("orders user IDs deterministically so userAId is always < userBId", () => {
    const id1 = "aaaa-1111";
    const id2 = "zzzz-9999";

    const pair1 = getCanonicalFriendshipPair(id1, id2);
    const pair2 = getCanonicalFriendshipPair(id2, id1);

    expect(pair1.userAId).toBe(id1);
    expect(pair1.userBId).toBe(id2);

    expect(pair2.userAId).toBe(id1);
    expect(pair2.userBId).toBe(id2);

    // Guaranteed symmetry
    expect(pair1).toEqual(pair2);
  });

  it("throws an error when trying to create a friendship with oneself", () => {
    const id = "user-123";
    expect(() => getCanonicalFriendshipPair(id, id)).toThrow(
      "Cannot create a friendship with oneself"
    );
  });
});
