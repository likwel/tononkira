/**
 * Corrections des paroles proposées depuis le site : visibles sur le site public
 * seulement après validation dans l'administration.
 * Les types `*Dto` sont la forme des réponses JSON (miroir côté web : web/src/lib/types.ts).
 */
import type { Page, PageQuery } from './catalog.js';

export const EDIT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type EditStatus = (typeof EDIT_STATUSES)[number];

export interface LyricEditDto {
  id: number;
  status: EditStatus;
  song: { artistSlug: string; slug: string; title: string };
  lyrics: string;
  /** Paroles publiées au moment de la proposition : sert à afficher ce qui change. */
  baseLyrics: string;
  note: string | null;
  author: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface NewLyricEdit {
  artistSlug: string;
  slug: string;
  lyrics: string;
  note?: string | undefined;
  author?: string | undefined;
}

export interface LyricEditQuery extends PageQuery {
  status?: EditStatus | undefined;
}

export interface LyricEdits {
  submit(input: NewLyricEdit): Promise<LyricEditDto | 'unknown-song' | 'unchanged'>;
  list(query: LyricEditQuery): Promise<Page<LyricEditDto>>;
  countPending(): Promise<number>;
  /**
   * `approve` remplace les paroles du catalogue par celles de la proposition
   * (ou par `lyrics` si l'administration les a retouchées), `reject` les laisse en place.
   */
  review(
    id: number,
    action: 'approve' | 'reject',
    lyrics?: string | undefined,
  ): Promise<LyricEditDto | 'not-found' | 'already-reviewed'>;
}
