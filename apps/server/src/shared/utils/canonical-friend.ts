/**
 * Ensures a canonical ordering of two user IDs in a friendship relation.
 * At the database level, unique constraint on (userAId, userBId) prevents
 * duplicate reciprocal friendships (A->B and B->A).
 */
export function getCanonicalFriendshipPair(
  id1: string,
  id2: string
): { userAId: string; userBId: string } {
  if (id1 === id2) {
    throw new Error("Cannot create a friendship with oneself");
  }
  return id1 < id2
    ? { userAId: id1, userBId: id2 }
    : { userAId: id2, userBId: id1 };
}
