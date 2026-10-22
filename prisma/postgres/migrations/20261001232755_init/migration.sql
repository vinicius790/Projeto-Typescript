-- CreateTable
CREATE TABLE "Prototype" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "primitive" INTEGER NOT NULL,
    "component" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clonedFromId" INTEGER,

    CONSTRAINT "Prototype_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircularReference" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "prototypeId" INTEGER NOT NULL,

    CONSTRAINT "CircularReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CircularReference_prototypeId_key" ON "CircularReference"("prototypeId");

-- AddForeignKey
ALTER TABLE "Prototype" ADD CONSTRAINT "Prototype_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "Prototype"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircularReference" ADD CONSTRAINT "CircularReference_prototypeId_fkey" FOREIGN KEY ("prototypeId") REFERENCES "Prototype"("id") ON DELETE CASCADE ON UPDATE CASCADE;
