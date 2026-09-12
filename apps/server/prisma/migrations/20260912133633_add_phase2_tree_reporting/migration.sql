/*
  Warnings:

  - Added the required column `idempotencyFingerprint` to the `Tree` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "MediaUploadIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "maxBytes" INTEGER NOT NULL DEFAULT 10485760,
    "status" TEXT NOT NULL DEFAULT 'PENDING_UPLOAD',
    "expiresAt" DATETIME NOT NULL,
    "uploadedAt" DATETIME,
    "attachedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaUploadIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tree" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "plantedAt" DATETIME NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "locationAccuracy" REAL,
    "locationSource" TEXT NOT NULL DEFAULT 'DEVICE_GPS',
    "locationName" TEXT NOT NULL,
    "notes" TEXT,
    "context" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "idempotencyFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tree_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Tree_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "TreeSpecies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Tree" ("context", "createdAt", "id", "idempotencyKey", "latitude", "locationAccuracy", "locationName", "locationSource", "longitude", "notes", "ownerId", "plantedAt", "speciesId", "status", "updatedAt", "verificationStatus") SELECT "context", "createdAt", "id", "idempotencyKey", "latitude", "locationAccuracy", "locationName", "locationSource", "longitude", "notes", "ownerId", "plantedAt", "speciesId", "status", "updatedAt", "verificationStatus" FROM "Tree";
DROP TABLE "Tree";
ALTER TABLE "new_Tree" RENAME TO "Tree";
CREATE UNIQUE INDEX "Tree_idempotencyKey_key" ON "Tree"("idempotencyKey");
CREATE INDEX "Tree_ownerId_idx" ON "Tree"("ownerId");
CREATE INDEX "Tree_speciesId_idx" ON "Tree"("speciesId");
CREATE INDEX "Tree_verificationStatus_idx" ON "Tree"("verificationStatus");
CREATE INDEX "Tree_latitude_longitude_idx" ON "Tree"("latitude", "longitude");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MediaUploadIntent_mediaId_key" ON "MediaUploadIntent"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUploadIntent_storageKey_key" ON "MediaUploadIntent"("storageKey");

-- CreateIndex
CREATE INDEX "MediaUploadIntent_userId_idx" ON "MediaUploadIntent"("userId");

-- CreateIndex
CREATE INDEX "MediaUploadIntent_storageKey_idx" ON "MediaUploadIntent"("storageKey");

-- CreateIndex
CREATE INDEX "MediaUploadIntent_status_idx" ON "MediaUploadIntent"("status");
