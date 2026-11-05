-- CreateTable
CREATE TABLE "lyric_edits" (
    "id" SERIAL NOT NULL,
    "song_id" INTEGER NOT NULL,
    "lyrics" TEXT NOT NULL,
    "base_lyrics" TEXT NOT NULL,
    "note" TEXT,
    "author" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "lyric_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lyric_edits_status_created_at_idx" ON "lyric_edits"("status", "created_at");

-- CreateIndex
CREATE INDEX "lyric_edits_song_id_idx" ON "lyric_edits"("song_id");

-- AddForeignKey
ALTER TABLE "lyric_edits" ADD CONSTRAINT "lyric_edits_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
