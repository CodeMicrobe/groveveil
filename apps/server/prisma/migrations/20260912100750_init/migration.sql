-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "publicHandle" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TreeSpecies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commonName" TEXT NOT NULL,
    "scientificName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TreeSpeciesAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "speciesId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "language" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreeSpeciesAlias_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "TreeSpecies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tree" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "plantedAt" DATETIME NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "locationAccuracy" REAL,
    "locationSource" TEXT NOT NULL DEFAULT 'device_gps',
    "locationName" TEXT NOT NULL,
    "notes" TEXT,
    "context" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tree_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tree_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "TreeSpecies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TreeMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "capturedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreeMedia_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "reviewerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationEvent_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AchievementDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'MILESTONE',
    "criteriaType" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "iconUrl" TEXT NOT NULL,
    "gpgId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" DATETIME,
    "gpgSyncedAt" DATETIME,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "AchievementDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Friendship_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GooglePlayGamesLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gpgPlayerId" TEXT NOT NULL,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GooglePlayGamesLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_publicHandle_key" ON "User"("publicHandle");

-- CreateIndex
CREATE UNIQUE INDEX "TreeSpecies_scientificName_key" ON "TreeSpecies"("scientificName");

-- CreateIndex
CREATE INDEX "TreeSpeciesAlias_alias_idx" ON "TreeSpeciesAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "TreeSpeciesAlias_speciesId_alias_key" ON "TreeSpeciesAlias"("speciesId", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "Tree_idempotencyKey_key" ON "Tree"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Tree_ownerId_idx" ON "Tree"("ownerId");

-- CreateIndex
CREATE INDEX "Tree_speciesId_idx" ON "Tree"("speciesId");

-- CreateIndex
CREATE INDEX "Tree_verificationStatus_idx" ON "Tree"("verificationStatus");

-- CreateIndex
CREATE INDEX "Tree_latitude_longitude_idx" ON "Tree"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "TreeMedia_storageKey_key" ON "TreeMedia"("storageKey");

-- CreateIndex
CREATE INDEX "TreeMedia_treeId_idx" ON "TreeMedia"("treeId");

-- CreateIndex
CREATE INDEX "VerificationEvent_treeId_idx" ON "VerificationEvent"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementDefinition_key_key" ON "AchievementDefinition"("key");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "Friendship_userAId_idx" ON "Friendship"("userAId");

-- CreateIndex
CREATE INDEX "Friendship_userBId_idx" ON "Friendship"("userBId");

-- CreateIndex
CREATE INDEX "Friendship_initiatedById_idx" ON "Friendship"("initiatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId");

-- CreateIndex
CREATE UNIQUE INDEX "GooglePlayGamesLink_userId_key" ON "GooglePlayGamesLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GooglePlayGamesLink_gpgPlayerId_key" ON "GooglePlayGamesLink"("gpgPlayerId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
