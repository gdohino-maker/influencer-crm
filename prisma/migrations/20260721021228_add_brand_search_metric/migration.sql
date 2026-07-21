-- CreateTable
CREATE TABLE "BrandSearchMetric" (
    "id" SERIAL NOT NULL,
    "brandId" INTEGER NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "searchTerm" TEXT NOT NULL DEFAULT '',
    "searchFrequencyRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandSearchMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandSearchMetric_brandId_reportDate_searchTerm_key" ON "BrandSearchMetric"("brandId", "reportDate", "searchTerm");

-- AddForeignKey
ALTER TABLE "BrandSearchMetric" ADD CONSTRAINT "BrandSearchMetric_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
