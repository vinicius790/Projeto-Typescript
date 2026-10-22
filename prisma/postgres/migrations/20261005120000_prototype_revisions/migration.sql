-- Preserve the current prototype state as revision 1 during the upgrade.
ALTER TABLE "Prototype" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "PrototypeRevision" (
    "id" SERIAL NOT NULL,
    "prototypeId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "primitive" INTEGER NOT NULL,
    "component" TIMESTAMP(3) NOT NULL,
    "circularReferenceLabel" TEXT,
    "actorId" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrototypeRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PrototypeRevision_prototypeId_fkey" FOREIGN KEY ("prototypeId") REFERENCES "Prototype"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrototypeRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PrototypeRevision_prototypeId_version_key" ON "PrototypeRevision"("prototypeId", "version");
CREATE INDEX "PrototypeRevision_prototypeId_recordedAt_idx" ON "PrototypeRevision"("prototypeId", "recordedAt");

INSERT INTO "PrototypeRevision" (
    "prototypeId", "version", "name", "primitive", "component",
    "circularReferenceLabel", "actorId", "recordedAt"
)
SELECT prototype."id", 1, prototype."name", prototype."primitive", prototype."component",
       circular."label", NULL, prototype."createdAt"
FROM "Prototype" AS prototype
LEFT JOIN "CircularReference" AS circular ON circular."prototypeId" = prototype."id";
