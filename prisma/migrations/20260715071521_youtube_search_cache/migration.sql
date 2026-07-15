-- CreateTable
CREATE TABLE "YoutubeSearchCache" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoutubeSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeSearchCache_keyword_key" ON "YoutubeSearchCache"("keyword");
