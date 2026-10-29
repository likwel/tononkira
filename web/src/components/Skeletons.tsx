const bar = 'animate-pulse rounded-md bg-surface-2';

export function SongCardSkeleton() {
  return (
    <div
      className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3"
      aria-hidden="true"
    >
      <div className={`size-12 rounded-2xl ${bar}`} />
      <div className="flex-1 space-y-2">
        <div className={`h-4 w-3/4 ${bar}`} />
        <div className={`h-3 w-1/2 ${bar}`} />
      </div>
    </div>
  );
}

export function ArtistCardSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-5"
      aria-hidden="true"
    >
      <div className={`size-16 rounded-full ${bar}`} />
      <div className={`h-4 w-2/3 ${bar}`} />
      <div className={`h-3 w-1/3 ${bar}`} />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex items-start gap-4 py-3.5" aria-hidden="true">
      <div className="flex-1 space-y-2">
        <div className={`h-5 w-2/3 ${bar}`} />
        <div className={`h-3 w-1/3 ${bar}`} />
      </div>
    </div>
  );
}

export function Repeat({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>{children}</div>
      ))}
    </>
  );
}

export function LoadingLabel() {
  return (
    <p className="sr-only" role="status">
      Chargement…
    </p>
  );
}
