-- CreateTable
CREATE TABLE "Prototype" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "primitive" INTEGER NOT NULL,
    "component" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clonedFromId" INTEGER,
    CONSTRAINT "Prototype_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "Prototype" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CircularReference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "prototypeId" INTEGER NOT NULL,
    CONSTRAINT "CircularReference_prototypeId_fkey" FOREIGN KEY ("prototypeId") REFERENCES "Prototype" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CircularReference_prototypeId_key" ON "CircularReference"("prototypeId");
