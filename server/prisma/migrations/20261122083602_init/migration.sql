-- CreateTable
CREATE TABLE "Peer" (
    "publicKey" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "notes" TEXT,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOnlineAt" DATETIME
);

-- CreateTable
CREATE TABLE "StatusEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicKey" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusEvent_publicKey_fkey" FOREIGN KEY ("publicKey") REFERENCES "Peer" ("publicKey") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StatusEvent_publicKey_at_idx" ON "StatusEvent"("publicKey", "at");
