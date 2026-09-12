/*
  Warnings:

  - Added the required column `updatedAt` to the `GooglePlayGamesLink` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "GooglePlayGamesSyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userAchievementId" TEXT NOT NULL,
    "gpgAchievementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GooglePlayGamesSyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GooglePlayGamesSyncJob_userAchievementId_fkey" FOREIGN KEY ("userAchievementId") REFERENCES "UserAchievement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GooglePlayGamesLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gpgPlayerId" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GooglePlayGamesLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GooglePlayGamesLink" ("gpgPlayerId", "id", "linkedAt", "userId") SELECT "gpgPlayerId", "id", "linkedAt", "userId" FROM "GooglePlayGamesLink";
DROP TABLE "GooglePlayGamesLink";
ALTER TABLE "new_GooglePlayGamesLink" RENAME TO "GooglePlayGamesLink";
CREATE UNIQUE INDEX "GooglePlayGamesLink_userId_key" ON "GooglePlayGamesLink"("userId");
CREATE UNIQUE INDEX "GooglePlayGamesLink_gpgPlayerId_key" ON "GooglePlayGamesLink"("gpgPlayerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GooglePlayGamesSyncJob_status_nextAttemptAt_idx" ON "GooglePlayGamesSyncJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "GooglePlayGamesSyncJob_userId_idx" ON "GooglePlayGamesSyncJob"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GooglePlayGamesSyncJob_userAchievementId_gpgAchievementId_key" ON "GooglePlayGamesSyncJob"("userAchievementId", "gpgAchievementId");
