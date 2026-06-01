-- CreateTable
CREATE TABLE "album_rankings" (
    "id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "spotify_id" TEXT,
    "album_name" TEXT NOT NULL,
    "artist_name" TEXT,
    "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ratings" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "album_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "album_rankings_album_id_key" ON "album_rankings"("album_id");
