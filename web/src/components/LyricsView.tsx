import { useMemo } from 'react';
import { isChorus, splitStanzas } from '../lib/lyrics';
import { cx } from './ui';

interface LyricsViewProps {
  lyrics: string;
  /** Taille du texte en rem. */
  size?: number;
}

export function LyricsView({ lyrics, size = 1.125 }: LyricsViewProps) {
  const stanzas = useMemo(() => splitStanzas(lyrics), [lyrics]);
  if (!stanzas.length) {
    return (
      <p className="text-muted italic">Les paroles de cette chanson ne sont pas disponibles.</p>
    );
  }

  return (
    <div
      lang="mg"
      className="font-serif text-ink"
      style={{ fontSize: `${size}rem`, lineHeight: 1.8 }}
    >
      {stanzas.map((stanza, index) => {
        const chorus = isChorus(stanza);
        return (
          <p
            key={index}
            data-chorus={chorus ? '' : undefined}
            className={cx(
              'mb-[1.4em] last:mb-0',
              chorus && 'border-l-2 border-accent/70 pl-4 text-ink-soft italic sm:pl-5',
            )}
          >
            {stanza.map((line, lineIndex) => (
              // Retrait suspendu : la suite d'un vers trop long pour l'écran est décalée.
              <span
                key={lineIndex}
                className="block pl-[1.25em] -indent-[1.25em] break-words whitespace-pre-wrap"
              >
                {line}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
