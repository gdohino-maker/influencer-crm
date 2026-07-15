-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "asin" TEXT,
    "productUrl" TEXT,
    "priceYen" INTEGER,
    "targetAgeBands" TEXT NOT NULL,
    "targetGender" TEXT NOT NULL,
    "targetGenres" TEXT NOT NULL,
    "searchKeyword" TEXT NOT NULL,
    "complianceProfileId" INTEGER NOT NULL,
    "scoringProfileId" INTEGER NOT NULL,
    "discoveryKeywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "brandId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "targetCount" INTEGER,
    "budgetYen" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'planning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "requirePr" BOOLEAN NOT NULL DEFAULT true,
    "requireRelation" BOOLEAN NOT NULL DEFAULT true,
    "requireCta" BOOLEAN NOT NULL DEFAULT true,
    "ngWords" TEXT,
    "okWords" TEXT,
    "extraNotes" TEXT,

    CONSTRAINT "ComplianceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "wAudience" INTEGER NOT NULL DEFAULT 30,
    "wGenre" INTEGER NOT NULL DEFAULT 20,
    "wEr" INTEGER NOT NULL DEFAULT 20,
    "wPhoto" INTEGER NOT NULL DEFAULT 15,
    "wNotJaded" INTEGER NOT NULL DEFAULT 10,
    "wActivity" INTEGER NOT NULL DEFAULT 5,
    "wFollower" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScoringProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Influencer" (
    "id" SERIAL NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "followers" INTEGER,
    "postsCount" INTEGER,
    "avgLike" INTEGER,
    "avgComment" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "lastEnrichedAt" TIMESTAMP(3),
    "ageBand" TEXT,
    "audienceAgeGuess" TEXT,
    "audienceGenderGuess" TEXT,
    "genreTags" TEXT,
    "photoQuality" INTEGER,
    "prFrequency" DOUBLE PRECISION,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Influencer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignInfluencer" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "influencerId" INTEGER NOT NULL,
    "audienceFit" INTEGER,
    "genreFit" INTEGER,
    "score" DOUBLE PRECISION,
    "excludeFlags" TEXT,
    "draftBlockA" TEXT,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignInfluencer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outreach" (
    "id" SERIAL NOT NULL,
    "campaignInfluencerId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "reply" TEXT,
    "agreedTerms" TEXT,

    CONSTRAINT "Outreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" SERIAL NOT NULL,
    "campaignInfluencerId" INTEGER NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "trackingNo" TEXT,
    "address" TEXT,
    "itemCost" INTEGER,
    "shippingFee" INTEGER,
    "rewardYen" INTEGER DEFAULT 0,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "campaignInfluencerId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "postType" TEXT,
    "caption" TEXT,
    "reach" INTEGER,
    "impressions" INTEGER,
    "likes" INTEGER,
    "saves" INTEGER,
    "comments" INTEGER,
    "linkClicks" INTEGER,
    "hasPr" BOOLEAN NOT NULL DEFAULT false,
    "hasRelation" BOOLEAN NOT NULL DEFAULT false,
    "hasCta" BOOLEAN NOT NULL DEFAULT false,
    "ngWordHit" TEXT,
    "secondaryUseOk" BOOLEAN NOT NULL DEFAULT false,
    "assetUrl" TEXT,
    "usedInAds" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Influencer_platform_username_key" ON "Influencer"("platform", "username");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignInfluencer_campaignId_influencerId_key" ON "CampaignInfluencer"("campaignId", "influencerId");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_complianceProfileId_fkey" FOREIGN KEY ("complianceProfileId") REFERENCES "ComplianceProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_scoringProfileId_fkey" FOREIGN KEY ("scoringProfileId") REFERENCES "ScoringProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInfluencer" ADD CONSTRAINT "CampaignInfluencer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInfluencer" ADD CONSTRAINT "CampaignInfluencer_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_campaignInfluencerId_fkey" FOREIGN KEY ("campaignInfluencerId") REFERENCES "CampaignInfluencer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_campaignInfluencerId_fkey" FOREIGN KEY ("campaignInfluencerId") REFERENCES "CampaignInfluencer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_campaignInfluencerId_fkey" FOREIGN KEY ("campaignInfluencerId") REFERENCES "CampaignInfluencer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
