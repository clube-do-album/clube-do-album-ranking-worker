-- CreateTable
CREATE TABLE "album_rating_snapshots" (
    "id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "album_rating_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "album_rating_snapshots_album_id_user_id_key" ON "album_rating_snapshots"("album_id", "user_id");
