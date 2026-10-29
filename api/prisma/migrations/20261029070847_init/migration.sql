-- Recherche floue (ILIKE accéléré, similarity()) : index GIN trigrammes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "artists" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_name" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "songs" (
    "id" SERIAL NOT NULL,
    "artist_slug" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sort_title" TEXT NOT NULL,
    "lyrics" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "contributor" TEXT,
    "published_at" TIMESTAMP(3),
    "image_url" TEXT,
    "audio_url" TEXT,
    "source" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "scraped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_artists" (
    "song_id" INTEGER NOT NULL,
    "artist_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "song_artists_pkey" PRIMARY KEY ("song_id","artist_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "artists_slug_key" ON "artists"("slug");

-- CreateIndex
CREATE INDEX "artists_sort_name_idx" ON "artists"("sort_name");

-- CreateIndex
CREATE INDEX "artists_name_trgm_idx" ON "artists" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "songs_source_url_key" ON "songs"("source_url");

-- CreateIndex
CREATE INDEX "songs_published_at_idx" ON "songs"("published_at");

-- CreateIndex
CREATE INDEX "songs_views_idx" ON "songs"("views");

-- CreateIndex
CREATE INDEX "songs_sort_title_idx" ON "songs"("sort_title");

-- CreateIndex
CREATE INDEX "songs_title_trgm_idx" ON "songs" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "songs_lyrics_trgm_idx" ON "songs" USING GIN ("lyrics" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "songs_artist_slug_slug_key" ON "songs"("artist_slug", "slug");

-- CreateIndex
CREATE INDEX "song_artists_artist_id_idx" ON "song_artists"("artist_id");

-- AddForeignKey
ALTER TABLE "song_artists" ADD CONSTRAINT "song_artists_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_artists" ADD CONSTRAINT "song_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
