import { CheckCircle2, LoaderCircle, Send, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSubmitEdit } from '../hooks/queries';
import { ApiError } from '../lib/api';
import type { SongDetail } from '../lib/types';
import { buttonGhost, buttonPrimary, buttonSecondary, cx } from './ui';

const MIN_LENGTH = 20;

const fieldClass =
  'mt-1.5 h-11 w-full rounded-xl border border-line bg-canvas px-3.5 text-base placeholder:text-muted/70 focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none';

const labelClass = 'block text-sm font-medium text-ink-soft';

export function LyricsEditForm({ song, onClose }: { song: SongDetail; onClose: () => void }) {
  const submit = useSubmitEdit(song.artistSlug, song.slug);
  const [lyrics, setLyrics] = useState(song.lyrics);
  const [note, setNote] = useState('');
  const [author, setAuthor] = useState('');

  const changed = lyrics.trim() !== song.lyrics.trim();
  const tooShort = lyrics.trim().length < MIN_LENGTH;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit.mutate({
      lyrics,
      note: note.trim() || undefined,
      author: author.trim() || undefined,
    });
  }

  if (submit.isSuccess) {
    return (
      <div className="mt-6 rounded-3xl border border-leaf/30 bg-leaf-soft/60 p-6 text-center sm:p-10">
        <span className="grid size-12 place-items-center rounded-full bg-leaf/15 text-leaf mx-auto">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-serif text-2xl font-semibold tracking-tight">Merci !</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft text-pretty">
          Votre correction a bien été envoyée. Elle sera relue par un administrateur avant d'être
          publiée : les paroles affichées ne changent pas tout de suite.
        </p>
        <button type="button" onClick={onClose} className={cx(buttonSecondary, 'mt-6')}>
          Revenir aux paroles
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight">Corriger les paroles</h2>
          <p className="mt-1.5 text-sm text-muted text-pretty">
            Modifiez le texte ci-dessous. Un administrateur relit la proposition avant publication.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Fermer"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <label htmlFor="edit-lyrics" className={cx(labelClass, 'mt-6')}>
        Paroles
      </label>
      <textarea
        id="edit-lyrics"
        value={lyrics}
        onChange={(event) => setLyrics(event.target.value)}
        rows={18}
        spellCheck={false}
        className="mt-1.5 w-full resize-y rounded-xl border border-line bg-canvas p-4 font-serif text-[17px] leading-relaxed whitespace-pre-wrap focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-note" className={labelClass}>
            Qu'avez-vous corrigé ? <span className="font-normal text-muted">(facultatif)</span>
          </label>
          <input
            id="edit-note"
            type="text"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Faute au 2e couplet…"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="edit-author" className={labelClass}>
            Votre nom <span className="font-normal text-muted">(facultatif)</span>
          </label>
          <input
            id="edit-author"
            type="text"
            value={author}
            maxLength={80}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder="Rakoto"
            className={fieldClass}
          />
        </div>
      </div>

      {submit.isError && (
        <p className="mt-5 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {submit.error instanceof ApiError ? submit.error.message : 'Envoi impossible.'}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!changed || tooShort || submit.isPending}
          className={buttonPrimary}
        >
          {submit.isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          Envoyer la correction
        </button>
        <button type="button" onClick={onClose} className={buttonGhost}>
          Annuler
        </button>
        {!changed && <p className="text-sm text-muted">Aucune modification pour l'instant.</p>}
        {changed && tooShort && (
          <p className="text-sm text-muted">Les paroles sont trop courtes.</p>
        )}
      </div>
    </form>
  );
}
