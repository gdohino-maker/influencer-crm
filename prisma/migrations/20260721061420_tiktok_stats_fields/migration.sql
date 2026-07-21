-- AlterTable
ALTER TABLE "Influencer" ADD COLUMN     "avgEngagement" INTEGER,
ADD COLUMN     "avgView" INTEGER,
ADD COLUMN     "contact" TEXT,
ADD COLUMN     "lastPublishedAt" TIMESTAMP(3),
ADD COLUMN     "postFreqWeek" DOUBLE PRECISION,
ADD COLUMN     "totalLikes" INTEGER,
ADD COLUMN     "videoAvgScore" DOUBLE PRECISION;
